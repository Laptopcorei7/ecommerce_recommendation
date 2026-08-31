# ElectroHub

A hybrid product recommender over the Amazon Reviews 2023 Electronics dataset,
served by a FastAPI model service, with a Next.js storefront.

The recommender blends a collaborative signal with a content-based one computed
from product metadata. It carries two collaborative factorizations, because
ranking and rating prediction are different problems:

- **Ranking** uses implicit-feedback ALS, which fits observed interactions and
  optimizes preference. This is what `GET /recommend/` returns.
- **Rating prediction** uses a bias-corrected truncated SVD, which optimizes
  squared error. This is what RMSE measures.

Both halves of each blend are put on a common scale before combining, so the
weight `alpha` is a real dial rather than a decoration.

## Layout

```
ml_api/            model service (FastAPI) and the training pipeline
  pipeline/        build_dataset -> train -> evaluate
    als.py         implicit-feedback ALS, and why it replaced SVD for ranking
  recommender.py   the scoring function, shared by the API and the evaluation
  model_loader.py  loads artifacts/model.npz and checks its invariants
frontend/          Next.js storefront
data/              downloaded corpora and derived artefacts (never committed)
```

## Running it

Two processes.

```bash
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate elsewhere
pip install -r ml_api/requirements.txt

# 1. model service
uvicorn ml_api.main:app --port 8001

# 2. storefront
cd frontend/ecommerce-app && pnpm install && pnpm dev
```

Check it:

```bash
curl "http://127.0.0.1:8001/health"
curl "http://127.0.0.1:8001/users/sample?n=3"
curl "http://127.0.0.1:8001/recommend/?user_id=<id>&top_n=5"
```

`GET /users/sample` returns user ids that exist in the trained model, which is
what to pass as `user_id`.

There was a Django project in front of this as an API gateway. It had no models,
no migrations and no auth, and forwarded requests unchanged, so it was removed
rather than kept for symmetry. It contributed one thing worth keeping, CORS,
which the model service configures itself via `CORS_ALLOWED_ORIGINS`.

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
leave-last-out test split, alpha 0.9.

| Metric | Value |
|---|---|
| RMSE | 1.2911 |
| MAE | 0.9409 |
| Recall@10 | 0.0188 |
| NDCG@10 | 0.0101 |
| Hit rate@10 | 0.0188 |

Hit rate@10 against baselines, 3,000 sampled users. A recommender that cannot
beat "show the most popular items" has not earned its complexity, so this
comparison is part of the standard evaluation rather than an afterthought.

| Model | Hit rate@10 |
|---|---|
| **Hybrid, alpha=0.9** | **0.0183** |
| Pure collaborative (ALS) | 0.0180 |
| Popularity | 0.0163 |
| Pure content | 0.0023 |
| Random | 0.0000 |

Two honest caveats. The gap between the hybrid and pure collaborative is 0.0003
on 3,000 users, which is about one user and well inside noise; the defensible
claim is that they are equivalent, not that the hybrid wins. And the margin over
popularity, while real and consistent, is modest.

The alpha sweep on the validation split shows the content half contributing
almost nothing to ranking:

| alpha | 0.0 | 0.2 | 0.5 | 0.7 | 0.9 | 1.0 |
|---|---|---|---|---|---|---|
| NDCG@10 | 0.00134 | 0.00868 | 0.01345 | 0.01576 | 0.01705 | 0.01709 |
| RMSE | 1.3170 | 1.2805 | 1.2392 | 1.2213 | 1.2115 | 1.2097 |

0.9 and 1.0 are indistinguishable. 0.9 is kept rather than 1.0 so the content
signal still covers items the collaborative model has thin evidence for, but
that benefit is not visible here: the 5-core benchmark guarantees every user and
item has at least five interactions, so by construction it cannot exhibit a
cold-start case. Treat the retained content weight as insurance, not as
something these numbers justify.

### What changed, and why

The first rebuild used `scipy.svds` for the collaborative half and it ranked no
better than random, losing to a popularity baseline by 3x. The cause was
measurable: `item_bias` had a standard deviation of 0.2281 while the
personalized term had 0.0017, a ratio of 0.007, so the ranking was 99% a single
global ordering identical for every user.

`svds` factorizes with every unobserved cell treated as a zero. At 0.0159%
density that is 99.98% of the objective, so the factors get crushed. Replacing
it with implicit-feedback ALS, which fits only observed interactions and
optimizes preference rather than rating value, moved pure collaborative hit rate
from 0.0003 to 0.0180, a factor of 60, and took it past the popularity baseline.

The model now carries both factorizations, because ranking and rating prediction
are genuinely different objectives and this project reports both.

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
