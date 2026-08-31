# ElectroHub

A hybrid product recommender over the Amazon Reviews 2023 Electronics dataset,
served through a FastAPI model service and a Django gateway, with a Next.js
storefront.

The recommender blends two predictors that both estimate a rating in [1, 5]:
matrix factorization over the user-item matrix, and a content-based score
computed from product metadata. Because both sit on the same scale, the blend
weight `alpha` is a real dial rather than a decoration.

## Layout

```
ml_api/            model service (FastAPI) and the training pipeline
  pipeline/        build_dataset -> train -> evaluate
  recommender.py   the scoring function, shared by the API and the evaluation
  model_loader.py  loads artifacts/model.npz and checks its invariants
backend/           Django gateway; proxies the storefront to the model service
frontend/          Next.js storefront
data/              downloaded corpora and derived artefacts (never committed)
```

## Running it

Three processes. The ports matter: the model service must not be on 8000,
because that is Django's `runserver` default.

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate elsewhere
pip install -r ml_api/requirements.txt -r backend/requirements.txt

# 1. model service
uvicorn ml_api.main:app --port 8001

# 2. django gateway
cp backend/.env.example backend/ecommerce_recommender/.env
python backend/ecommerce_recommender/manage.py runserver 8000

# 3. storefront
cd frontend/ecommerce-app && pnpm install && pnpm dev
```

Check the chain end to end:

```bash
curl "http://127.0.0.1:8001/health"
curl "http://127.0.0.1:8000/api/health/"
curl "http://127.0.0.1:8000/api/recommend/?user_id=<id>&top_n=5"
```

`GET http://127.0.0.1:8001/users/sample` returns user ids that exist in the
trained model, which is what to pass as `user_id`.

## Rebuilding the model

The trained model is a build output and is not in git. Download the source data
as described in [`data/raw/SOURCES.md`](data/raw/SOURCES.md), then:

```bash
python -m ml_api.pipeline.build_dataset   # sample users, k-core, join metadata
python -m ml_api.pipeline.train           # factorization + content similarity
python -m ml_api.pipeline.evaluate        # RMSE, Precision@K, Recall@K, NDCG@K
python -m ml_api.pipeline.evaluate --tune-alpha
```

Every tunable lives in `ml_api/pipeline/config.py`. Sampling is a stable hash of
`user_id`, so the same `USER_SAMPLE_RATE` selects the same users on any machine.
Raising it grows the dataset; the cost is roughly quadratic in item count,
because the content similarity step compares every item against every other.

## Current results

Dataset after sampling and iterative k-core: 119,173 users, 62,222 items,
1,179,677 interactions, density 0.0159%. Evaluated on the dataset's own
leave-last-out test split, 77,450 test users.

| Metric | Value |
|---|---|
| RMSE | 1.3035 |
| MAE | 0.9598 |
| Recall@10 | 0.0043 |
| NDCG@10 | 0.0020 |
| Hit rate@10 | 0.0043 |

Hit rate@10 against baselines, 3,000 sampled users:

| Model | Hit rate@10 |
|---|---|
| Popularity | 0.0123 |
| Pure content | 0.0040 |
| Hybrid, alpha=0.7 | 0.0037 |
| Pure collaborative | 0.0003 |
| Random | 0.0003 |

**The ranking quality is poor and the collaborative half is the reason.** It
scores level with random, and the full model loses to a popularity baseline by
roughly 3x. This is a real result, not a plumbing failure: the service chain
works and the blend is now genuinely blending.

The cause is measurable. Across items, `item_bias` has a standard deviation of
0.2281 while the personalized term `<user_factors, item_factors>` has a standard
deviation of 0.0017, a ratio of 0.007. The collaborative ranking is therefore
about 99% a single global ordering by item bias, identical for every user; its
top-10 for a given user is exactly the global top-10 by `item_bias`.

Plain truncated SVD is the wrong tool here. `svds` treats every unobserved cell
as a zero, and at 0.0159% density the objective is dominated by fitting those
zeros, which shrinks the learned factors to near nothing. Fitting only the
observed entries, with ALS or SGD, is the standard remedy. For top-N ranking
specifically, an implicit-feedback objective such as BPR or weighted ALS
optimizes the thing being measured, whereas RMSE-optimal rating prediction is
known to rank badly.

Worth noting the shape of this: the ratio 0.007 is the same one that made the
old content term inert. The previous version had a dead content half; this one
has a dead personalization term inside its collaborative half. The difference is
that the evaluation now reports it instead of hiding it.


## Notes on the rebuild

This project was written under deadline in 2025 and rebuilt in 2026. Four
defects were load-bearing and are worth naming, because the code now exists to
prevent each of them recurring.

**The hybrid was not hybrid.** The two score vectors were blended raw on
incompatible scales: collaborative scores spanned about 4.0, content scores
about 0.028. At `alpha=0.7` the content term could shift a score by at most
0.008, so it could not reorder anything. Both halves now predict a rating on the
same scale.

**Two item orderings.** The old model file carried `item_to_idx` and
`content_item_to_idx`, different permutations of the same items, and the serving
code mixed them, so content similarity was read for the wrong products. There is
now one ordering, `item_ids`, and `model_loader.py` refuses to load a file whose
item-indexed arrays disagree about their length.

**The user's history was not in the model file.** The old code recovered it with
`np.nonzero(item_factors @ user_vector)`, a dense dot product that returns every
item, so the content score was the same constant vector for every user. The
training interaction matrix is now stored in the model file and indexed directly.

**The measured model was not the served model.** The notebook evaluated a
predictor using the SVD singular values and clipping to [1, 5]; the API
implemented neither, and `sigma` was never even saved. `recommender.py` is now
the only scoring implementation, imported by both the API and `evaluate.py`, so
a reported metric always describes the code that serves traffic.

Evaluation uses the dataset's own leave-last-out benchmark rather than a random
split. A random split over interactions trains on a user's later purchases and
tests on earlier ones, which leaks future information and inflates every metric.
