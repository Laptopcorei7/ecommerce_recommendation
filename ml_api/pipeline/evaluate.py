"""Evaluate the trained model on the official leave-last-out holdout.

Run:  python -m ml_api.pipeline.evaluate
      python -m ml_api.pipeline.evaluate --tune-alpha

Two properties matter more than the numbers themselves.

First, this imports HybridRecommender, the same class the API serves from. The
previous project reported an RMSE measured in the notebook against a scoring
function the API did not implement, so the published number described code that
never ran in production.

Second, the split is the dataset's own leave-last-out benchmark: each user's
chronologically last interaction is the test item. The previous version used a
random split over interactions, which trains on a user's later purchases and
tests on earlier ones, and inflates every metric.
"""

from __future__ import annotations

import argparse
import json
import sys
import time

import numpy as np
import pandas as pd

from ml_api.model_loader import load_model
from ml_api.pipeline import config as cfg
from ml_api.recommender import HybridRecommender


def _log(msg):
    print("[eval] " + msg, flush=True)


def rmse_mae(eng, hold, alpha=None):
    """Rating prediction error over every holdout interaction."""
    u_idx = eng.user_to_idx
    i_idx = eng.m["item_to_idx"]
    errs = []
    for uid, iid, actual in zip(hold["user_id"], hold["parent_asin"], hold["rating"]):
        if uid not in u_idx or iid not in i_idx:
            continue
        pred = eng.predict(u_idx[uid], i_idx[iid], alpha=alpha)
        errs.append(pred - float(actual))
    e = np.asarray(errs)
    return float(np.sqrt((e ** 2).mean())), float(np.abs(e).mean()), len(e)


def ranking_metrics(eng, test_by_user, k=10, alpha=None, max_users=5000, seed=42):
    """Precision@K, Recall@K, NDCG@K and hit rate over the last-out test items.

    With one held-out item per user, Precision@K is Recall@K / K, but both are
    reported because both appear in the literature this will be compared against.
    """
    rng = np.random.default_rng(seed)
    users = list(test_by_user.keys())
    if len(users) > max_users:
        users = [users[i] for i in rng.choice(len(users), max_users, replace=False)]

    i_idx = eng.m["item_to_idx"]
    hits, ndcgs, recalls = [], [], []
    t0 = time.time()
    for n, uid in enumerate(users, 1):
        truth = {i_idx[a] for a in test_by_user[uid] if a in i_idx}
        if not truth:
            continue
        scores, rated = eng.hybrid_scores(eng.user_to_idx[uid], alpha)
        scores = scores.copy()
        if len(rated):
            scores[rated] = -np.inf
        part = np.argpartition(scores, -k)[-k:]
        top = part[np.argsort(scores[part])[::-1]]

        hit = [1.0 if i in truth else 0.0 for i in top]
        hits.append(max(hit))
        recalls.append(sum(hit) / len(truth))
        dcg = sum(h / np.log2(r + 2) for r, h in enumerate(hit))
        idcg = sum(1.0 / np.log2(r + 2) for r in range(min(len(truth), k)))
        ndcgs.append(dcg / idcg if idcg else 0.0)

        if n % 1000 == 0:
            _log("    {}/{} users ({:.0f}s)".format(n, len(users), time.time() - t0))

    n_eval = len(recalls)
    return {
        "users_evaluated": n_eval,
        "precision_at_k": float(np.mean(recalls) / k * 1.0) if n_eval else 0.0,
        "recall_at_k": float(np.mean(recalls)) if n_eval else 0.0,
        "ndcg_at_k": float(np.mean(ndcgs)) if n_eval else 0.0,
        "hit_rate_at_k": float(np.mean(hits)) if n_eval else 0.0,
    }


def score_scale_report(eng, n_users=200, seed=0):
    """Diagnostic for the two defects that made the old model non-personalized.

    First: the old blend combined a collaborative term spanning about 4.0 with a
    content term spanning about 0.028, so the content half could not move a
    ranking at any alpha. Both halves are standardized now, so the ratio should
    sit near 1.0.

    Second, found after that was fixed: the SVD personalized term had a standard
    deviation of 0.0017 against 0.2281 for item_bias, so the ranking was one
    global ordering shared by every user. ALS should push that well up.
    """
    rng = np.random.default_rng(seed)
    n = len(eng.m["user_ids"])
    idx = rng.choice(n, min(n_users, n), replace=False)
    p_spread, k_spread, personal, firsts = [], [], [], []
    for u in idx:
        rated, vals = eng.rated_items(u)
        pref = eng.preference_scores(u)
        content = eng.content_scores(u, rated, vals)
        p_spread.append(pref.std())
        k_spread.append(content.std())
        personal.append(pref.std())
        firsts.append(content[:64].copy())
    same = all(np.allclose(firsts[0], f) for f in firsts[1:])
    return {
        "preference_std_mean": float(np.mean(p_spread)),
        "content_std_mean": float(np.mean(k_spread)),
        "personalized_term_std": float(np.mean(personal)),
        "item_bias_std": float(eng.m["item_bias"].std()),
        "content_identical_across_users": bool(same),
    }


def baselines(eng, test_by_user, k=10, max_users=3000, seed=42):
    """Popularity and random, evaluated exactly like the model.

    A recommender that cannot beat "show the most popular items" has not earned
    its complexity. Reporting hit rate without this comparison is how the
    previous version's ranking failure stayed invisible.
    """
    rng = np.random.default_rng(seed)
    users = list(test_by_user.keys())
    if len(users) > max_users:
        users = [users[i] for i in rng.choice(len(users), max_users, replace=False)]
    i_idx = eng.m["item_to_idx"]
    pop = np.asarray((eng.m["train_matrix"] > 0).sum(axis=0)).ravel().astype(float)

    def run(score_fn):
        hits = n = 0
        for uid in users:
            truth = {i_idx[a] for a in test_by_user[uid] if a in i_idx}
            if not truth:
                continue
            u = eng.user_to_idx[uid]
            sc = score_fn(u).copy()
            rated, _ = eng.rated_items(u)
            sc[rated] = -np.inf
            top = np.argpartition(sc, -k)[-k:]
            hits += len(truth & set(top.tolist())) > 0
            n += 1
        return hits / max(n, 1)

    return {
        "popularity": run(lambda u: pop),
        "random": run(lambda u: rng.random(eng.n_items)),
        "pure_collaborative": run(lambda u: eng.preference_scores(u)),
        "pure_content": run(lambda u: eng.content_scores(u)),
        "hybrid": run(lambda u: eng.hybrid_scores(u)[0]),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tune-alpha", action="store_true")
    ap.add_argument("--k", type=int, default=cfg.EVAL_K)
    ap.add_argument("--max-users", type=int, default=5000)
    args = ap.parse_args()

    _log("loading model")
    eng = HybridRecommender(load_model(cfg.MODEL_NPZ), alpha=cfg.ALPHA)
    hold = pd.read_parquet(cfg.HOLDOUT_PARQUET)
    test = hold[hold["split"] == "test"]
    test_by_user = test.groupby("user_id")["parent_asin"].apply(list).to_dict()
    test_by_user = {u: v for u, v in test_by_user.items() if u in eng.user_to_idx}
    _log("  {:,} holdout rows, {:,} test users".format(len(hold), len(test_by_user)))

    _log("score scale diagnostic")
    scale = score_scale_report(eng)
    for key, val in scale.items():
        _log("  {:<34} {}".format(key, val))
    if scale["content_identical_across_users"]:
        _log("  FAIL: content scores do not vary by user")
    if scale["personalized_term_std"] < 0.01:
        _log("  FAIL: personalized term too small; ranking is a global ordering")

    if args.tune_alpha:
        _log("tuning alpha on the validation split")
        valid = hold[hold["split"] == "valid"]
        vbu = valid.groupby("user_id")["parent_asin"].apply(list).to_dict()
        vbu = {u: v for u, v in vbu.items() if u in eng.user_to_idx}
        rows = []
        for a in [0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
            r = ranking_metrics(eng, vbu, args.k, a, max_users=1500)
            rr, _, _ = rmse_mae(eng, valid.head(20000), alpha=a)
            rows.append((a, r["ndcg_at_k"], r["recall_at_k"], rr))
            _log("  alpha={:.1f}  ndcg@{}={:.5f}  recall@{}={:.5f}  rmse={:.4f}".format(
                a, args.k, r["ndcg_at_k"], args.k, r["recall_at_k"], rr))
        best = max(rows, key=lambda r: r[1])
        _log("  best alpha by ndcg: {:.1f}".format(best[0]))
        _log("  set ALPHA in ml_api/pipeline/config.py and retrain to bake it in")

    _log("rating prediction on the test split")
    rmse, mae, n = rmse_mae(eng, test)
    _log("  RMSE {:.4f}  MAE {:.4f}  over {:,} pairs".format(rmse, mae, n))

    _log("ranking on the test split")
    rank = ranking_metrics(eng, test_by_user, args.k, max_users=args.max_users)
    for key, val in rank.items():
        _log("  {:<20} {}".format(key, round(val, 6) if isinstance(val, float) else val))

    _log("baselines (the model must beat popularity to be worth anything)")
    base = baselines(eng, test_by_user, args.k)
    for key, val in sorted(base.items(), key=lambda kv: -kv[1]):
        _log("  {:<20} hit-rate@{} {:.4f}".format(key, args.k, val))
    if base["hybrid"] <= base["popularity"]:
        _log("  FAIL: the hybrid does not beat a popularity baseline")

    out = {
        "alpha": eng.alpha,
        "baselines": base,
        "k": args.k,
        "rmse": rmse, "mae": mae, "rating_pairs": n,
        **rank, "score_scale": scale,
    }
    path = cfg.ARTIFACTS / "evaluation.json"
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    _log("wrote " + str(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
