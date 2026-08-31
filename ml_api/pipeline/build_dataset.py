"""Build a trainable dataset from the raw Amazon Reviews 2023 Electronics files.

Produces three artefacts in data/processed/:
  interactions.parquet  training interactions, whole user histories
  holdout.parquet       the official leave-last-out valid/test rows for those users
  catalog.jsonl         product metadata for every surviving item

Run:  python -m ml_api.pipeline.build_dataset
"""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
import time

import pandas as pd

from ml_api.pipeline import config as cfg

COLS = {"user_id": "str", "parent_asin": "str", "rating": "float32", "timestamp": "int64"}


def _log(msg):
    print("[build] " + msg, flush=True)


def _keep_user(uid, rate):
    """Stable hash sample. Same users on every run, on every machine."""
    h = hashlib.blake2b(uid.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(h, "big") % 1_000_000 < rate * 1_000_000


def sample_users(df, rate):
    uniq = pd.Index(df["user_id"].unique())
    keep = {u for u in uniq if _keep_user(u, rate)}
    out = df[df["user_id"].isin(keep)]
    _log("user sample @ {:.3%}: {:,} -> {:,} users, {:,} rows".format(
        rate, len(uniq), len(keep), len(out)))
    return out


def iterative_kcore(df, min_u, min_i, max_passes):
    """Apply the k-core filter until the row count stops changing.

    A single pass leaves the data not actually k-core: removing thin items drops
    some users below the user threshold, and removing those users drops further
    items below the item threshold.
    """
    for p in range(1, max_passes + 1):
        before = len(df)
        ic = df["parent_asin"].value_counts()
        df = df[df["parent_asin"].isin(ic[ic >= min_i].index)]
        uc = df["user_id"].value_counts()
        df = df[df["user_id"].isin(uc[uc >= min_u].index)]
        after = len(df)
        _log("  k-core pass {}: {:,} -> {:,} rows ({:,} users, {:,} items)".format(
            p, before, after, df["user_id"].nunique(), df["parent_asin"].nunique()))
        if after == before:
            _log("  converged after {} pass(es)".format(p))
            return df
        if after == 0:
            raise SystemExit("k-core removed everything; raise USER_SAMPLE_RATE")
    _log("  WARNING: did not converge in {} passes".format(max_passes))
    return df


def _clean_price(raw):
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw) if raw > 0 else None
    s = str(raw).strip().lstrip("$").replace(",", "")
    if not s:
        return None
    s = s.split()[0].split("-")[0]
    try:
        v = float(s)
    except ValueError:
        return None
    return v if v > 0 else None


def _first_image(images):
    """Metadata images are a dict of parallel lists, or a list of dicts."""
    if not images:
        return None
    if isinstance(images, dict):
        for key in ("large", "hi_res", "thumb"):
            for v in images.get(key) or []:
                if v:
                    return v
        return None
    if isinstance(images, list):
        for im in images:
            if isinstance(im, dict):
                for key in ("large", "hi_res", "thumb"):
                    if im.get(key):
                        return im[key]
            elif isinstance(im, str) and im:
                return im
    return None


def _as_text(v):
    if v is None:
        return ""
    if isinstance(v, list):
        return " ".join(_as_text(x) for x in v)
    return str(v)


def load_metadata(wanted, path):
    """Stream the 1.25GB gzip once, keeping only items we actually need."""
    found = {}
    seen = 0
    t0 = time.time()
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            seen += 1
            if seen % 500_000 == 0:
                _log("  scanned {:,} metadata rows, matched {:,}/{:,}".format(
                    seen, len(found), len(wanted)))
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            pa = rec.get("parent_asin")
            if pa is None or pa not in wanted or pa in found:
                continue
            title = (rec.get("title") or "").strip()
            if not title:
                continue
            text_parts = [
                title,
                _as_text(rec.get("features"))[:1500],
                _as_text(rec.get("description"))[:2500],
                " ".join(rec.get("categories") or []),
                rec.get("store") or "",
            ]
            found[pa] = {
                "id": pa,
                "title": title[:300],
                "price": _clean_price(rec.get("price")),
                "image": _first_image(rec.get("images")),
                "store": (rec.get("store") or "").strip()[:120] or None,
                "main_category": rec.get("main_category"),
                "categories": [c for c in (rec.get("categories") or []) if c][:6],
                "average_rating": rec.get("average_rating"),
                "rating_number": rec.get("rating_number"),
                # Text used for content features. Deliberately never review text:
                # that would make an item's content vector a function of how many
                # reviews it has, leaking popularity into the content-based half.
                "text": " ".join(p for p in text_parts if p)[:5000],
            }
            if len(found) == len(wanted):
                break
    _log("  metadata scan done in {:.0f}s: {:,}/{:,} matched".format(
        time.time() - t0, len(found), len(wanted)))
    return found


def main():
    t0 = time.time()
    cfg.PROCESSED.mkdir(parents=True, exist_ok=True)

    for p in (cfg.TRAIN_CSV, cfg.VALID_CSV, cfg.TEST_CSV, cfg.META_GZ):
        if not p.exists():
            raise SystemExit("missing raw file: {}\nSee data/raw/SOURCES.md".format(p))

    _log("loading train interactions")
    train = pd.read_csv(cfg.TRAIN_CSV, dtype=COLS)
    _log("  {:,} rows, {:,} users, {:,} items".format(
        len(train), train.user_id.nunique(), train.parent_asin.nunique()))

    train = sample_users(train, cfg.USER_SAMPLE_RATE)
    _log("applying iterative k-core")
    train = iterative_kcore(
        train, cfg.MIN_USER_INTERACTIONS, cfg.MIN_ITEM_INTERACTIONS, cfg.KCORE_MAX_PASSES)

    _log("joining product metadata")
    meta = load_metadata(set(train["parent_asin"].unique()), cfg.META_GZ)

    # Items with no usable metadata cannot get content features, so they leave
    # the dataset. That breaks k-core again, so it is re-applied afterwards.
    before = len(train)
    train = train[train["parent_asin"].isin(meta.keys())]
    _log("  dropped {:,} rows for items with no metadata".format(before - len(train)))
    _log("re-applying k-core after metadata drop")
    train = iterative_kcore(
        train, cfg.MIN_USER_INTERACTIONS, cfg.MIN_ITEM_INTERACTIONS, cfg.KCORE_MAX_PASSES)

    users = set(train["user_id"].unique())
    items = set(train["parent_asin"].unique())

    _log("loading official leave-last-out holdout")
    hold = pd.concat(
        [
            pd.read_csv(cfg.VALID_CSV, dtype=COLS).assign(split="valid"),
            pd.read_csv(cfg.TEST_CSV, dtype=COLS).assign(split="test"),
        ],
        ignore_index=True,
    )
    hold = hold[hold["user_id"].isin(users) & hold["parent_asin"].isin(items)]
    n_test = int((hold["split"] == "test").sum())
    _log("  {:,} holdout rows for sampled users ({:,} test)".format(len(hold), n_test))

    train = train.sort_values(["user_id", "timestamp"], kind="stable").reset_index(drop=True)
    train.to_parquet(cfg.INTERACTIONS_PARQUET, index=False)
    hold.reset_index(drop=True).to_parquet(cfg.HOLDOUT_PARQUET, index=False)

    with open(cfg.CATALOG_JSONL, "w", encoding="utf-8") as fh:
        for pa in sorted(items):
            fh.write(json.dumps(meta[pa], ensure_ascii=False) + "\n")

    n_u, n_i = len(users), len(items)
    _log("")
    _log("=" * 58)
    _log("users        {:,}".format(n_u))
    _log("items        {:,}".format(n_i))
    _log("interactions {:,}".format(len(train)))
    _log("density      {:.6%}".format(len(train) / (n_u * n_i)))
    _log("mean rating  {:.3f}".format(train.rating.mean()))
    _log("holdout      {:,}".format(len(hold)))
    _log("elapsed      {:.0f}s".format(time.time() - t0))
    _log("=" * 58)
    return 0


if __name__ == "__main__":
    sys.exit(main())
