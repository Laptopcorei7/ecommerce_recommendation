"""Model service. The only backend.

Serves recommendations as full product objects, not bare ids. The original
version returned a list of ASIN strings, which the storefront had no way to
render, which is part of why the storefront never called it.

A Django project used to sit in front of this as a gateway. It had no models,
no migrations and no auth, and did nothing but forward the request unchanged,
so it was deleted rather than kept for symmetry. Its one real contribution was
CORS, which is configured here now.

Run:  uvicorn ml_api.main:app --port 8001 --reload
"""

from __future__ import annotations

import os
from collections import Counter
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ml_api.catalog import MIN_BUCKET, SORTS, Catalog
from ml_api.model_loader import ModelFormatError, load_catalog, load_model
from ml_api.pipeline import config as cfg
from ml_api.recommender import HybridRecommender

HERE = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", HERE / "artifacts" / "model.npz"))
CATALOG_PATH = Path(os.getenv("CATALOG_PATH", HERE / "artifacts" / "catalog.jsonl"))

# Origins allowed to call this from a browser. The storefront is a separate
# origin, so without this every request from it fails at the preflight.
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if o.strip()
]

state = {"engine": None, "catalog": {}, "index": None, "error": None}


@asynccontextmanager
async def lifespan(app):
    """Load at startup, but keep a failure serviceable.

    Loading at import time meant any problem with the model file killed the
    worker with a traceback and no way to ask what was wrong. Now /health says.
    """
    try:
        model = load_model(MODEL_PATH)
        # Alpha comes from config, not the model file. See config.ALPHA.
        alpha = float(os.getenv("ALPHA", cfg.ALPHA))
        state["engine"] = HybridRecommender(model, alpha=alpha)
        state["catalog"] = load_catalog(CATALOG_PATH)
        # Browse indexes. Built once here rather than per request; see catalog.py.
        # The bucket threshold is overridable so a smaller catalogue (a test
        # fixture, a trimmed dataset) is not folded entirely into "Other".
        state["index"] = Catalog(
            state["catalog"],
            min_bucket=int(os.getenv("CATALOG_MIN_BUCKET", MIN_BUCKET)),
        )
        print("[ml_api] loaded {:,} users, {:,} items, alpha={:.2f} "
              "(model file recorded {:.2f} at training time)".format(
                  len(model["user_ids"]), len(model["item_ids"]),
                  alpha, model["alpha"]))
        print("[ml_api] catalogue: {:,} products in {} categories".format(
            len(state["index"]), len(state["index"].categories())))
    except (ModelFormatError, OSError) as exc:
        state["error"] = str(exc)
        print("[ml_api] MODEL LOAD FAILED: {}".format(exc))
    yield


app = FastAPI(title="ElectroHub recommender", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)


class Product(BaseModel):
    id: str
    title: str
    price: float | None = None
    image: str | None = None
    store: str | None = None
    categories: list[str] = []
    average_rating: float | None = None
    rating_number: int | None = None
    # The bucket this product browses under, after the tail folding in
    # catalog.py. Sent so the storefront links to a category page that exists
    # instead of re-deriving a slug it cannot know has been folded away.
    category_slug: str | None = None
    category_name: str | None = None
    # Set on the recommendation path only; a catalogue listing has no score.
    score: float | None = None
    # The two weighted halves of the blend, which sum to score. The storefront
    # shows these instead of captioning a placement with invented copy.
    collaborative: float | None = None
    content: float | None = None
    # Set on a shopper's history only: the rating that shopper gave the item.
    user_rating: float | None = None


class RecommendationResponse(BaseModel):
    user_id: str
    count: int
    alpha: float
    items: list[Product]
    # What the model learned this shopper from. Without it a ranked list is
    # an answer with no question: a reader cannot judge whether the picks fit.
    rated: int
    history: list[Product]


class ShopperSummary(BaseModel):
    id: str
    rated: int
    top_category: str | None = None


class SampleUsers(BaseModel):
    user_ids: list[str]
    # The same shoppers, described by their real training history so the
    # storefront can label them with something other than a 28-character id.
    users: list[ShopperSummary]


class Category(BaseModel):
    slug: str
    name: str
    count: int


class ProductPage(BaseModel):
    total: int
    page: int
    pages: int
    per_page: int
    items: list[Product]


class ProductDetail(BaseModel):
    product: Product
    similar: list[Product]


def _engine():
    if state["engine"] is None:
        raise HTTPException(status_code=503, detail=state["error"] or "model not loaded")
    return state["engine"]


def _index():
    if state["index"] is None:
        raise HTTPException(status_code=503, detail=state["error"] or "catalogue not loaded")
    return state["index"]


def _product(item_id, meta=None, **extra):
    """Build a Product from catalogue metadata.

    The id is the fallback title. A recommendation whose metadata is missing
    must still render, so an incomplete catalogue degrades to a bare id rather
    than a 500.
    """
    meta = state["catalog"].get(item_id, {}) if meta is None else meta
    bucket = state["index"].bucket(item_id) if state["index"] else None
    return Product(
        id=item_id,
        title=meta.get("title") or item_id,
        price=meta.get("price"),
        image=meta.get("image"),
        store=meta.get("store"),
        categories=meta.get("categories") or [],
        average_rating=meta.get("average_rating"),
        rating_number=meta.get("rating_number"),
        category_slug=bucket["slug"] if bucket else None,
        category_name=bucket["name"] if bucket else None,
        **extra,
    )


@app.get("/health")
def health():
    if state["engine"] is None:
        return {"status": "error", "detail": state["error"]}
    eng = state["engine"]
    return {
        "status": "ok",
        "users": len(eng.user_to_idx),
        "items": eng.n_items,
        "factors": eng.m["n_factors"],
        "alpha": eng.alpha,
        "alpha_at_training": eng.m["alpha"],
        "catalog": len(state["catalog"]),
    }


@app.get("/recommend/", response_model=RecommendationResponse)
def recommend(
    user_id: str = Query(..., description="A user id present in the training data"),
    top_n: int = Query(10, ge=1, le=100),
    alpha: float | None = Query(None, ge=0.0, le=1.0, description="Override the blend weight"),
    history_n: int = Query(6, ge=0, le=50, description="How many rated items to return"),
):
    eng = _engine()
    try:
        ranked = eng.recommend_detailed(user_id, top_n=top_n, alpha=alpha)
    except KeyError:
        raise HTTPException(status_code=404, detail="user not found: {}".format(user_id))

    items = [
        _product(
            r["id"],
            score=round(r["score"], 4),
            collaborative=round(r["collaborative"], 4),
            content=round(r["content"], 4),
        )
        for r in ranked
    ]
    rated = _rated(eng, user_id)
    # Highest rated first, then most rated overall, so the history opens on
    # the items that say most about this shopper's taste.
    rated.sort(key=lambda r: (-r[1], -(state["catalog"].get(r[0], {}).get("rating_number") or 0)))
    history = [_product(item_id, user_rating=float(value)) for item_id, value in rated[:history_n]]

    return RecommendationResponse(
        user_id=user_id,
        count=len(items),
        alpha=eng.alpha if alpha is None else alpha,
        items=items,
        rated=len(rated),
        history=history,
    )


def _rated(eng, user_id):
    """(item id, rating) for every item this shopper rated in training."""
    indices, values = eng.rated_items(eng.user_to_idx[user_id])
    return [(str(eng.item_ids[i]), v) for i, v in zip(indices, values)]


SAMPLE_SCAN = 2000


def _summary(eng, uid):
    rated = _rated(eng, uid)
    buckets = Counter(b["name"] for b in (state["index"].bucket(i) for i, _ in rated) if b)
    top = buckets.most_common(1)
    return ShopperSummary(id=uid, rated=len(rated), top_category=top[0][0] if top else None)


@app.get("/users/sample", response_model=SampleUsers)
def sample_users(n: int = Query(10, ge=1, le=100)):
    """Valid shoppers to recommend for, chosen to be told apart.

    The first n ids in the file were 27 of 40 "mostly Computers & Accessories",
    which is 43% of the catalogue, so the storefront's labels could not tell
    them apart. This scans the first SAMPLE_SCAN shoppers, groups them by the
    category they rate most, and deals them out one category at a time with
    the longest histories first. It is deterministic, so a numbered shopper in
    the storefront is the same person on every visit.
    """
    eng = _engine()
    groups = {}
    for uid in eng.m["user_ids"][:max(n, SAMPLE_SCAN)]:
        s = _summary(eng, str(uid))
        groups.setdefault(s.top_category, []).append(s)
    queues = sorted(groups.values(), key=len, reverse=True)
    for q in queues:
        q.sort(key=lambda s: -s.rated)

    users = []
    while len(users) < n and any(queues):
        for q in queues:
            if q and len(users) < n:
                users.append(q.pop(0))
    return SampleUsers(user_ids=[u.id for u in users], users=users)


# --- catalogue --------------------------------------------------------------
#
# Browsing is not a recommender question. These endpoints exist because a
# storefront has to be able to show a category, run a search and open one
# product, none of which the model can answer.


@app.get("/catalog/categories", response_model=list[Category])
def categories():
    """Every browse bucket with its size, largest first."""
    return _index().categories()


@app.get("/catalog/products", response_model=ProductPage)
def products(
    q: str | None = Query(None, description="Match against title and brand"),
    category: str | None = Query(None, description="Category slug"),
    sort: str = Query("popular", description="One of: " + ", ".join(SORTS)),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=96),
):
    if sort not in SORTS:
        raise HTTPException(
            status_code=422,
            detail="sort must be one of: {}".format(", ".join(SORTS)),
        )
    if category and _index().category(category) is None:
        raise HTTPException(status_code=404, detail="no such category: {}".format(category))

    result = _index().search(q=q, category=category, sort=sort, page=page, per_page=per_page)
    return ProductPage(
        total=result["total"],
        page=result["page"],
        pages=result["pages"],
        per_page=result["per_page"],
        items=[_product(r["id"], r) for r in result["items"]],
    )


@app.get("/catalog/products/{item_id}", response_model=ProductDetail)
def product_detail(item_id: str, similar: int = Query(8, ge=0, le=24)):
    """One product, with its nearest neighbours by content similarity.

    'Similar' here reads the same item-item matrix the content half of the
    blend uses, so the product page and the model agree on what similar means.
    """
    meta = state["catalog"].get(item_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="no such product: {}".format(item_id))

    neighbours = []
    if similar:
        try:
            neighbours = _engine().similar_items(item_id, k=similar)
        except KeyError:
            # In the catalogue but not in the model. Nothing to compare it to,
            # which is a thinner page, not an error.
            neighbours = []

    return ProductDetail(
        product=_product(item_id, meta),
        similar=[_product(i, score=round(s, 4)) for i, s in neighbours],
    )
