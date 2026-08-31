# Data sources

Amazon Reviews 2023, Electronics category, collected by the McAuley Lab at UC
San Diego. Retrieved 31 August 2026.

Project page: https://amazon-reviews-2023.github.io/

## Files

| File | Source | Size |
|---|---|---|
| `Electronics.train.csv` | `benchmark/5core/last_out/Electronics.train.csv` (Hugging Face) | 675 MB, 12,191,485 rows |
| `Electronics.valid.csv` | `benchmark/5core/last_out/Electronics.valid.csv` (Hugging Face) | 91 MB, 1,641,027 rows |
| `Electronics.test.csv` | `benchmark/5core/last_out/Electronics.test.csv` (Hugging Face) | 91 MB, 1,641,027 rows |
| `meta_Electronics.jsonl.gz` | UCSD mirror, `raw/meta_categories/` | 1.24 GB |

Interactions:
`https://huggingface.co/datasets/McAuley-Lab/Amazon-Reviews-2023/resolve/main/benchmark/5core/last_out/Electronics.{train,valid,test}.csv`

Metadata (not mirrored on Hugging Face, use UCSD):
`https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023/raw/meta_categories/meta_Electronics.jsonl.gz`

## Why these files

The `5core/last_out` benchmark is the dataset's own published split: every user
and item has at least five interactions, and each user's chronologically last
interaction is held out as test, the second to last as validation. Using it
means the evaluation protocol is the standard one for this dataset rather than
a random split invented here, and results are comparable to published work.

The previous version of this project used a 500k-row slice of unrecorded
provenance and split it randomly with `train_test_split(stratify=rating)`. A
random split over interactions trains on a user's later purchases and tests on
earlier ones, which leaks future information and inflates every metric.

Product metadata is used for content features and for the storefront catalogue.
The previous version derived content features from concatenated review text,
which makes an item's content vector partly a function of how many reviews it
has, leaking popularity into the content-based half of the hybrid.

## Reproducing

These files are not in git; `.gitignore` excludes `data/`. Re-download with the
URLs above, then:

    python -m ml_api.pipeline.build_dataset
    python -m ml_api.pipeline.train
    python -m ml_api.pipeline.evaluate

Sampling is a stable hash of `user_id`, so the same `USER_SAMPLE_RATE` in
`ml_api/pipeline/config.py` selects the same users on any machine.
