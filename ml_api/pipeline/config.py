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

# --- implicit ALS (ranking) ---
# Ranking and rating prediction are different objectives, so the model carries
# two factorizations. ALS on implicit preference drives the top-N ranking;
# the SVD-on-residual factorization stays for rating prediction and RMSE.
# See ml_api/pipeline/als.py for why plain SVD ranks no better than random here.
ALS_ITERATIONS = 15
ALS_REG = 0.05
ALS_CONFIDENCE = 40.0

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

# Weight on the collaborative half.
#
# For ranking the two halves measure different things (an ALS preference score
# and a predicted rating), so both are standardized to zero mean and unit
# variance before blending. Standardizing is order-preserving within each half,
# so it changes nothing about what each half believes, only the scale on which
# they are combined. Without it the smaller-variance half cannot influence the
# result at any alpha, which is the defect that made the original hybrid a pure
# collaborative model.
#
# For rating prediction both halves are already on the 1-5 scale and are
# blended directly. Re-tune with: evaluate.py --tune-alpha
#
# THIS VALUE IS THE SOURCE OF TRUTH. The trained model file also stores an
# alpha, but only as a record of what was used at training time; the API and
# the evaluation both read it from here. Alpha is a blend weight applied at
# scoring time, so tuning it must not require a ten-minute retrain.
#
# Tuned on the validation split, 2,000 users: ndcg@10 rises monotonically with
# alpha (0.0 -> 0.00134, 0.5 -> 0.01345, 0.9 -> 0.01705, 1.0 -> 0.01709), so
# 0.9 and 1.0 are within noise of each other and the content half adds nothing
# measurable to ranking on this data. 0.9 is kept rather than 1.0 so the
# content signal still covers items the collaborative model has thin evidence
# for. That benefit is not visible in these numbers: the 5-core benchmark
# guarantees every user and item has at least five interactions, so it cannot
# exhibit a cold-start case by construction.
ALPHA = 0.9

# ---------------------------------------------------------------- evaluation

EVAL_K = 10
EVAL_MAX_USERS = 20000
