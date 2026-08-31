"""Train the hybrid recommender and write ml_api/artifacts/model.npz.

Run:  python -m ml_api.pipeline.train

The model file has ONE canonical item ordering. item_ids[i] is the item at
index i in item_factors, item_bias, every axis of content_sim, and the columns
of train_matrix. The previous model file carried two different orderings over
the same items, item_to_idx and content_item_to_idx, and the serving code mixed
them, so the content half of the hybrid was reading the wrong products.
There is deliberately no second mapping here to get wrong.
"""

from __future__ import annotations

import json
import sys
import time

import numpy as np
import pandas as pd
import scipy.sparse as sp
from scipy.sparse.linalg import svds
from sklearn.feature_extraction.text import TfidfVectorizer

from ml_api.pipeline import config as cfg
from ml_api.pipeline.als import fit_als

MODEL_FORMAT_VERSION = 3


def _log(msg):
    print("[train] " + msg, flush=True)


def build_matrix(df, user_ids, item_ids):
    u_idx = {u: i for i, u in enumerate(user_ids)}
    i_idx = {a: i for i, a in enumerate(item_ids)}
    rows = df["user_id"].map(u_idx).to_numpy(np.int32)
    cols = df["parent_asin"].map(i_idx).to_numpy(np.int32)
    vals = df["rating"].to_numpy(np.float32)
    m = sp.csr_matrix((vals, (rows, cols)), shape=(len(user_ids), len(item_ids)))
    m.sum_duplicates()
    return m


def fit_factors(mat, n_factors, seed):
    """Biased matrix factorization via truncated SVD on the residual.

    Biases are removed first so the factors model interaction effects rather
    than re-learning per-user and per-item offsets. sigma is folded into the
    user factors, so scoring is a plain dot product and no caller can forget it.
    The previous export dropped sigma entirely, which is why the served model
    could not reproduce the notebook's own predictions.
    """
    mat = mat.tocsr()
    nnz_per_user = np.diff(mat.indptr)
    total = mat.data.sum()
    global_mean = float(total / mat.nnz)
    _log("  global mean {:.4f}".format(global_mean))

    # Damped means: an item with three ratings should not get an extreme bias.
    user_sum = np.asarray(mat.sum(axis=1)).ravel()
    user_bias = (user_sum - global_mean * nnz_per_user) / (nnz_per_user + 10.0)

    csc = mat.tocsc()
    nnz_per_item = np.diff(csc.indptr)
    item_sum = np.asarray(mat.sum(axis=0)).ravel()
    # Remove the user bias already accounted for, per item.
    ub_sum_per_item = np.zeros(mat.shape[1])
    np.add.at(ub_sum_per_item, mat.indices, user_bias[np.repeat(
        np.arange(mat.shape[0]), nnz_per_user)])
    item_bias = (item_sum - global_mean * nnz_per_item - ub_sum_per_item) / (
        nnz_per_item + 10.0)

    # Residual matrix, kept sparse: only observed cells are centred.
    resid = mat.copy().astype(np.float64)
    user_of_nnz = np.repeat(np.arange(mat.shape[0]), nnz_per_user)
    resid.data = (
        resid.data - global_mean - user_bias[user_of_nnz] - item_bias[mat.indices])

    k = min(n_factors, min(mat.shape) - 1)
    _log("  svds k={} on {}x{} ({:,} nnz)".format(k, mat.shape[0], mat.shape[1], mat.nnz))
    t0 = time.time()
    rng = np.random.default_rng(seed)
    v0 = rng.standard_normal(min(resid.shape))
    U, S, Vt = svds(resid, k=k, v0=v0)
    order = np.argsort(S)[::-1]
    U, S, Vt = U[:, order], S[order], Vt[order]
    _log("  svds done in {:.0f}s, top sigma {:.2f}, bottom {:.2f}".format(
        time.time() - t0, S[0], S[-1]))

    # Fold sigma in here so it can never be dropped downstream.
    user_factors = (U * S).astype(np.float32)
    item_factors = Vt.T.astype(np.float32)
    return (global_mean, user_bias.astype(np.float32), item_bias.astype(np.float32),
            user_factors, item_factors, S.astype(np.float32))


def content_similarity(texts, top_k, chunk_rows):
    """Top-K cosine similarity per item over TF-IDF of product metadata.

    The full n_items^2 matrix does not fit in memory, so rows are processed in
    chunks and only the strongest K neighbours per item are kept.
    """
    _log("  vectorizing {:,} product texts".format(len(texts)))
    vec = TfidfVectorizer(
        max_features=cfg.TFIDF_MAX_FEATURES,
        ngram_range=cfg.TFIDF_NGRAM_RANGE,
        min_df=cfg.TFIDF_MIN_DF,
        max_df=cfg.TFIDF_MAX_DF,
        stop_words="english",
        strip_accents="unicode",
        sublinear_tf=True,
        dtype=np.float32,
    )
    X = vec.fit_transform(texts)
    X = X.tocsr()
    _log("  tfidf {} x {} ({:,} nnz)".format(X.shape[0], X.shape[1], X.nnz))

    n = X.shape[0]
    Xt = X.T.tocsc()
    rows, cols, vals = [], [], []
    t0 = time.time()
    for start in range(0, n, chunk_rows):
        stop = min(start + chunk_rows, n)
        block = np.asarray((X[start:stop] @ Xt).todense(), dtype=np.float32)
        # An item is not its own neighbour.
        for r in range(stop - start):
            block[r, start + r] = 0.0
        kk = min(top_k, n - 1)
        part = np.argpartition(block, -kk, axis=1)[:, -kk:]
        for r in range(stop - start):
            idx = part[r]
            v = block[r, idx]
            keep = v > 1e-4
            idx, v = idx[keep], v[keep]
            rows.append(np.full(len(idx), start + r, dtype=np.int32))
            cols.append(idx.astype(np.int32))
            vals.append(v)
        if (start // chunk_rows) % 5 == 0:
            done = stop / n
            el = time.time() - t0
            _log("    {:.0%} ({:.0f}s elapsed, ~{:.0f}s left)".format(
                done, el, el / max(done, 1e-9) - el))
    sim = sp.csr_matrix(
        (np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))),
        shape=(n, n), dtype=np.float32)
    sim.sort_indices()
    _log("  content_sim {:,} nnz ({:.1f} per item)".format(sim.nnz, sim.nnz / n))
    return sim


def main():
    t0 = time.time()
    cfg.ARTIFACTS.mkdir(parents=True, exist_ok=True)

    if not cfg.INTERACTIONS_PARQUET.exists():
        raise SystemExit("run: python -m ml_api.pipeline.build_dataset")

    _log("loading processed interactions")
    df = pd.read_parquet(cfg.INTERACTIONS_PARQUET)

    catalog = {}
    with open(cfg.CATALOG_JSONL, encoding="utf-8") as fh:
        for line in fh:
            rec = json.loads(line)
            catalog[rec["id"]] = rec

    # THE canonical ordering. Sorted so a rebuild on the same data is identical.
    item_ids = np.array(sorted(catalog.keys()), dtype=object)
    user_ids = np.array(sorted(df["user_id"].unique()), dtype=object)
    _log("  {:,} users, {:,} items, {:,} interactions".format(
        len(user_ids), len(item_ids), len(df)))

    assert set(df["parent_asin"].unique()) <= set(item_ids), "interaction item not in catalog"

    _log("building interaction matrix")
    train_matrix = build_matrix(df, user_ids, item_ids)

    _log("fitting explicit factors (rating prediction)")
    gm, ub, ib, uf, itf, sigma = fit_factors(train_matrix, cfg.N_FACTORS, cfg.RANDOM_SEED)

    _log("fitting implicit ALS factors (ranking)")
    als_u, als_i = fit_als(
        train_matrix,
        n_factors=cfg.N_FACTORS,
        iterations=cfg.ALS_ITERATIONS,
        reg=cfg.ALS_REG,
        confidence=cfg.ALS_CONFIDENCE,
        seed=cfg.RANDOM_SEED,
        log=_log,
    )

    _log("building content similarity")
    texts = [catalog[a]["text"] for a in item_ids]
    sim = content_similarity(texts, cfg.CONTENT_TOP_K, cfg.CONTENT_CHUNK_ROWS)

    # Ordering invariant: everything indexed by item is the same length and in
    # the same order as item_ids. Checked again at load time.
    assert itf.shape[0] == len(item_ids) == ib.shape[0] == sim.shape[0] == sim.shape[1]
    assert als_i.shape[0] == len(item_ids)
    assert als_u.shape[0] == len(user_ids)
    assert train_matrix.shape == (len(user_ids), len(item_ids))

    _log("writing " + str(cfg.MODEL_NPZ))
    np.savez_compressed(
        cfg.MODEL_NPZ,
        format_version=np.int32(MODEL_FORMAT_VERSION),
        item_ids=item_ids,
        user_ids=user_ids,
        user_factors=uf,
        item_factors=itf,
        als_user_factors=als_u,
        als_item_factors=als_i,
        user_bias=ub,
        item_bias=ib,
        sigma=sigma,
        global_mean=np.float32(gm),
        alpha=np.float32(cfg.ALPHA),
        n_factors=np.int32(uf.shape[1]),
        content_data=sim.data, content_indices=sim.indices,
        content_indptr=sim.indptr, content_shape=np.array(sim.shape, dtype=np.int64),
        train_data=train_matrix.data, train_indices=train_matrix.indices,
        train_indptr=train_matrix.indptr,
        train_shape=np.array(train_matrix.shape, dtype=np.int64),
    )

    # The served catalogue drops the "text" field. That field exists only to
    # build TF-IDF features and is up to 5000 characters per item, so carrying
    # it into the API means loading ~100MB of training data the service never
    # reads.
    with open(cfg.SERVED_CATALOG, "w", encoding="utf-8") as fh:
        for pa in item_ids:
            rec = {k: v for k, v in catalog[pa].items() if k != "text"}
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    size = cfg.MODEL_NPZ.stat().st_size / 1048576
    _log("")
    _log("=" * 58)
    _log("model.npz    {:.1f} MB".format(size))
    _log("factors      {} (explicit + implicit ALS)".format(uf.shape[1]))
    _log("global mean  {:.4f}".format(gm))
    _log("elapsed      {:.0f}s".format(time.time() - t0))
    _log("=" * 58)
    return 0


if __name__ == "__main__":
    sys.exit(main())
