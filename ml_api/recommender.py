"""Hybrid scoring.

This module is the single definition of what the model predicts. The API and
the evaluation script both import it, so a reported metric always describes the
function that actually serves traffic. The previous version of this project had
two different scoring implementations, one in the notebook and one in the API,
and the published RMSE described the one that was never served.

Two objectives, two paths
-------------------------
Ranking and rating prediction are different problems and the model carries a
factorization for each.

  recommend()  ranks by implicit-ALS preference blended with content similarity.
               Both halves are standardized first, because they measure
               different quantities on different scales.

  predict()    estimates a rating in [1, 5] from the explicit factorization
               blended with content, both already on the rating scale.

Why ranking standardizes and rating prediction does not
-------------------------------------------------------
Standardizing is order-preserving within a half, so it changes nothing about
what that half believes, only the scale on which the two are combined. Skipping
it is what broke the original: a collaborative term spanning 4.0 was blended
with a content term spanning 0.028, so the content half could not move the
ranking at any alpha. For rating prediction both halves already predict the same
quantity on the same scale, so blending them directly is correct and keeps the
result interpretable as a rating.
"""

from __future__ import annotations

import numpy as np

RATING_MIN = 1.0
RATING_MAX = 5.0


def _standardize(v):
    """Zero mean, unit variance. Order-preserving; only the scale changes."""
    sd = v.std()
    if sd < 1e-12:
        return np.zeros_like(v)
    return (v - v.mean()) / sd


class HybridRecommender:
    def __init__(self, model, alpha=None):
        self.m = model
        self.alpha = float(model["alpha"] if alpha is None else alpha)

        self.item_ids = model["item_ids"]
        self.user_to_idx = model["user_to_idx"]
        self.n_items = len(self.item_ids)
        self.global_mean = float(model["global_mean"])

        self._uf = model["user_factors"]
        self._if = model["item_factors"]
        self._au = model["als_user_factors"]
        self._ai = model["als_item_factors"]
        self._ub = model["user_bias"]
        self._ib = model["item_bias"]
        self._sim = model["content_sim"]
        self._train = model["train_matrix"]

    # ---------------------------------------------------------------- pieces

    def rated_items(self, user_idx):
        """Indices and ratings of the items this user rated in training.

        The previous version tried to recover this with
        np.nonzero(item_factors @ user_vector), which is a dense dot product and
        so returned every item in the catalogue. The interaction matrix is now
        stored in the model file, so the history is exact.
        """
        row = self._train.getrow(user_idx)
        return row.indices, row.data

    def preference_scores(self, user_idx):
        """Implicit-ALS preference for every item. The ranking signal."""
        return self._au[user_idx] @ self._ai.T

    def rating_scores(self, user_idx, clip=True):
        """Predicted rating for every item, from the explicit factorization."""
        s = (
            self.global_mean
            + self._ub[user_idx]
            + self._ib
            + self._uf[user_idx] @ self._if.T
        )
        return np.clip(s, RATING_MIN, RATING_MAX) if clip else s

    def content_scores(self, user_idx, rated_idx=None, rated_vals=None):
        """Predicted rating for every item, from content similarity.

        Similarity-weighted average of the ratings the user gave to items whose
        content resembles the target. Items with no similar rated item fall back
        to the global mean.
        """
        if rated_idx is None:
            rated_idx, rated_vals = self.rated_items(user_idx)
        out = np.full(self.n_items, self.global_mean, dtype=np.float64)
        if len(rated_idx) == 0:
            return out
        sub = self._sim[rated_idx]                       # (n_rated, n_items)
        num = np.asarray(rated_vals @ sub).ravel()       # weighted rating sum
        den = np.asarray(sub.sum(axis=0)).ravel()        # weight sum
        hit = den > 1e-9
        out[hit] = num[hit] / den[hit]
        # Already a weighted average of observed ratings, so bounded by
        # construction. No clipping needed and none applied.
        return out

    # ---------------------------------------------------------------- blend

    def score_halves(self, user_idx, alpha=None):
        """The two standardized halves of the ranking score, kept separate.

        The blend is a weighted sum of these, so returning them lets a caller
        report which half actually moved an item up the ranking instead of
        inventing a reason for it. Both are z-scores over the catalogue, so
        they are directly comparable to each other.
        """
        rated_idx, rated_vals = self.rated_items(user_idx)
        pref = _standardize(self.preference_scores(user_idx))
        content = _standardize(self.content_scores(user_idx, rated_idx, rated_vals))
        return pref, content, rated_idx

    def hybrid_scores(self, user_idx, alpha=None):
        """Ranking score for every item, plus this user's rated indices."""
        a = self.alpha if alpha is None else float(alpha)
        pref, content, rated_idx = self.score_halves(user_idx, alpha)
        return a * pref + (1.0 - a) * content, rated_idx

    # ---------------------------------------------------------------- public

    def recommend(self, user_id, top_n=10, alpha=None, exclude_rated=True):
        """Top-N item ids with scores, highest first."""
        return [
            (r["id"], r["score"])
            for r in self.recommend_detailed(user_id, top_n, alpha, exclude_rated)
        ]

    def recommend_detailed(self, user_id, top_n=10, alpha=None, exclude_rated=True):
        """Top-N with the two half-scores that produced each blended score.

        Same ranking as recommend(), which is written in terms of this. The
        extra fields exist so the storefront can show what drove a placement
        rather than captioning it with invented copy.
        """
        if user_id not in self.user_to_idx:
            raise KeyError(user_id)
        user_idx = self.user_to_idx[user_id]
        a = self.alpha if alpha is None else float(alpha)
        pref, content, rated_idx = self.score_halves(user_idx, alpha)
        scores = a * pref + (1.0 - a) * content

        excluded = 0
        if exclude_rated and len(rated_idx):
            # Recommending back what someone already bought is the most visible
            # failure mode a recommender has.
            scores = scores.copy()
            scores[rated_idx] = -np.inf
            excluded = len(rated_idx)

        # Cap at the number of items actually eligible. Without this, a top_n
        # near the catalogue size returns the excluded items too, carrying their
        # -inf sentinel out to the caller.
        n = min(top_n, self.n_items - excluded)
        if n <= 0:
            return []
        # argpartition finds the top n without sorting all n_items.
        part = np.argpartition(scores, -n)[-n:]
        order = part[np.argsort(scores[part])[::-1]]
        return [
            {
                "id": str(self.item_ids[i]),
                "score": float(scores[i]),
                # Weighted contributions, so the two sum to the score and the
                # larger one is the half that decided the placement.
                "collaborative": float(a * pref[i]),
                "content": float((1.0 - a) * content[i]),
            }
            for i in order
            if np.isfinite(scores[i])
        ]

    def similar_items(self, item_id, k=8):
        """Items nearest this one by content similarity, nearest first.

        Reads the same item-item matrix the content half of the blend uses, so
        'similar' on a product page means the same thing it means in the model.
        """
        idx = self.m["item_to_idx"].get(str(item_id))
        if idx is None:
            raise KeyError(item_id)
        row = self._sim.getrow(idx)
        cols, vals = row.indices, row.data
        keep = cols != idx                       # an item is its own best match
        cols, vals = cols[keep], vals[keep]
        if len(cols) == 0:
            return []
        n = min(k, len(cols))
        part = np.argpartition(vals, -n)[-n:]
        order = part[np.argsort(vals[part])[::-1]]
        return [(str(self.item_ids[cols[j]]), float(vals[j])) for j in order]

    def predict(self, user_idx, item_idx, alpha=None):
        """Predicted rating in [1, 5] for one user-item pair, for RMSE.

        Uses the explicit factorization, not the ALS one: ALS scores preference,
        which has no rating scale to report.
        """
        a = self.alpha if alpha is None else float(alpha)
        collab = (
            self.global_mean
            + self._ub[user_idx]
            + self._ib[item_idx]
            + self._uf[user_idx] @ self._if[item_idx]
        )
        collab = min(max(collab, RATING_MIN), RATING_MAX)

        rated_idx, rated_vals = self.rated_items(user_idx)
        if len(rated_idx) == 0:
            content = self.global_mean
        else:
            col = self._sim[rated_idx, item_idx]
            w = np.asarray(col.todense()).ravel() if hasattr(col, "todense") else np.asarray(col).ravel()
            den = w.sum()
            content = float(rated_vals @ w / den) if den > 1e-9 else self.global_mean
            content = min(max(content, RATING_MIN), RATING_MAX)

        return a * collab + (1.0 - a) * content
