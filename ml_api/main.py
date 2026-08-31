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
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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

state = {"engine": None, "catalog": {}, "error": None}


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
        print("[ml_api] loaded {:,} users, {:,} items, alpha={:.2f} "
              "(model file recorded {:.2f} at training time)".format(
                  len(model["user_ids"]), len(model["item_ids"]),
                  alpha, model["alpha"]))
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
    score: float


class RecommendationResponse(BaseModel):
    user_id: str
    count: int
    items: list[Product]


def _engine():
    if state["engine"] is None:
        raise HTTPException(status_code=503, detail=state["error"] or "model not loaded")
    return state["engine"]


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
):
    eng = _engine()
    try:
        ranked = eng.recommend(user_id, top_n=top_n, alpha=alpha)
    except KeyError:
        raise HTTPException(status_code=404, detail="user not found: {}".format(user_id))

    items = []
    for item_id, score in ranked:
        meta = state["catalog"].get(item_id, {})
        items.append(
            Product(
                id=item_id,
                title=meta.get("title") or item_id,
                price=meta.get("price"),
                image=meta.get("image"),
                store=meta.get("store"),
                categories=meta.get("categories") or [],
                average_rating=meta.get("average_rating"),
                rating_number=meta.get("rating_number"),
                score=round(score, 4),
            )
        )
    return RecommendationResponse(user_id=user_id, count=len(items), items=items)


@app.get("/users/sample")
def sample_users(n: int = Query(10, ge=1, le=100)):
    """Valid user ids, so the storefront and the docs have something to call with."""
    eng = _engine()
    return {"user_ids": [str(u) for u in eng.m["user_ids"][:n]]}
