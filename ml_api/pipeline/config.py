"""Configuration for the recommender build pipeline.

Every path and every tunable lives here so a rebuild is reproducible from one
file. Nothing downstream hardcodes a path.

Source data: Amazon Reviews 2023 (McAuley Lab, UCSD), Electronics category.
  interactions  benchmark/5core/last_out/Electronics.{train,valid,test}.csv
  metadata      raw/meta_categories/meta_Electronics.jsonl.gz
See data/raw/SOURCES.md for the exact URLs and retrieval date.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
ARTIFACTS = ROOT / "ml_api" / "artifacts"

TRAIN_CSV = RAW / "Electronics.train.csv"
VALID_CSV = RAW / "Electronics.valid.csv"
TEST_CSV = RAW / "Electronics.test.csv"
META_GZ = RAW / "meta_Electronics.jsonl.gz"

INTERACTIONS_PARQUET = PROCESSED / "interactions.parquet"
HOLDOUT_PARQUET = PROCESSED / "holdout.parquet"
CATALOG_JSONL = PROCESSED / "catalog.jsonl"

MODEL_NPZ = ARTIFACTS / "model.npz"
SERVED_CATALOG = ARTIFACTS / "catalog.jsonl"

# ---------------------------------------------------------------- sampling

# Fraction of users kept, chosen by a stable hash of user_id so the sample is
# identical on every run and on every machine. Whole user histories are kept
# or dropped together; sampling individual rows would destroy the interaction
# histories the collaborative model learns from.
USER_SAMPLE_RATE = 0.18

# Iterative k-core. The source data is already 5-core over the full category,
# but sampling users breaks that invariant, so it is re-applied here until the
# counts stop changing. A single pass is not enough: dropping thin items pushes
# users below the threshold, which pushes further items below it.
MIN_USER_INTERACTIONS = 5
MIN_ITEM_INTERACTIONS = 5
KCORE_MAX_PASSES = 20

# ---------------------------------------------------------------- model

N_FACTORS = 64
RANDOM_SEED = 42

# Content features are drawn from product metadata (title, features,
# description, categories, store), not from review text. Review text would
# make an item's content vector a function of how many reviews it has, which
# smuggles a popularity signal into the content-based half of the hybrid.
TFIDF_MAX_FEATURES = 20000
TFIDF_NGRAM_RANGE = (1, 2)
TFIDF_MIN_DF = 2
TFIDF_MAX_DF = 0.5

# Neighbours retained per item in the content similarity matrix. The full
# matrix is n_items^2 and does not fit in memory; only the top-K per row
# carries usable signal anyway.
CONTENT_TOP_K = 50
CONTENT_CHUNK_ROWS = 2000

# Weight on the collaborative half. Both score vectors are standardized before
# blending, so this is now a real 0..1 dial. Re-tuned by evaluate.py --tune-alpha.
ALPHA = 0.7

# ---------------------------------------------------------------- evaluation

EVAL_K = 10
EVAL_MAX_USERS = 20000
