import os
from typing import List

import numpy as np
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from ml_api.model_loader import load_model

app = FastAPI()

# Load model
model_path = os.path.join(
    os.path.dirname(__file__), "hybrid_recommender_optimized.npz"
)
model = load_model(model_path)


class RecommendationResponse(BaseModel):
    user_id: str
    recommended_items: List[str]


@app.get("/recommend/", response_model=RecommendationResponse)
def recommend(
    user_id: str = Query(..., example="A2GKVGAX1KCTJL"),
    top_n: int = 10,
):
    user_to_idx = model["user_to_idx"]
    item_to_idx = model["item_to_idx"]
    idx_to_item = model["idx_to_item"]

    if user_id not in user_to_idx:
        raise HTTPException(status_code=404, detail="User not found")

    user_idx = user_to_idx[user_id]
    user_vector = model["user_factors"][user_idx]
    user_bias = model["user_bias"][user_idx]

    # Collaborative score
    collab_scores = (
        user_vector @ model["item_factors"].T
        + model["item_bias"]
        + user_bias
        + model["global_mean"]
    )

    # Content score
    user_rated_items = np.nonzero(
        model["item_factors"] @ user_vector
    )[0]
    content_scores = (
        model["content_sim"][user_rated_items].mean(axis=0).A1
        if len(user_rated_items) > 0
        else np.zeros(len(item_to_idx))
    )

    alpha = model["alpha"]
    hybrid_scores = (
        alpha * collab_scores + (1 - alpha) * content_scores
    )

    top_indices = np.argsort(hybrid_scores)[::-1][:top_n]
    top_items = [idx_to_item[i] for i in top_indices]

    return RecommendationResponse(
        user_id=user_id, recommended_items=top_items
    )
