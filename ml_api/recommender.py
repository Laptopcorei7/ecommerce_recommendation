"""Hybrid scoring.

This module is the single definition of what the model predicts. The API and
the evaluation script both import it, so a reported metric always describes the
function that actually serves traffic. The previous version of this project had
two different scoring implementations, one in the notebook and one in the API,
and the published RMSE described the one that was never served.

Both halves of the hybrid predict the same quantity, a rating in [1, 5]:

  collaborative  global_mean + user_bias + item_bias + <user_factors, item_factors>
  content        rating-weighted mean over the user's rated items, weighted by
                 content similarity between those items and the target

Because both are on the rating scale, alpha is a real dial and the blend is
interpretable. Blending two quantities on different scales, as the previous
version did, meant the smaller one could not affect the ranking at all.
"""

from __future__ import annotations

import numpy as np

RATING_MIN = 1.0
RATING_MAX = 5.0


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
        self._ub = model["user_bias"]
        self._ib = model["item_bias"]
        self._sim = model["content_sim"]
        self._train = model["train_matrix"]

    # ---------------------------------------------------------------- pieces

    def collaborative_scores(self, user_idx, clip=True):
        """Predicted rating for every item, from the factorization.

        clip=True bounds the result to the rating scale, which is right for
        predicting a rating. It is wrong for ranking: for an enthusiastic user
        thousands of items predict above 5.0 and clipping ties them all at
        exactly 5.0, so the top-N becomes an arbitrary pick among the ties.
        Ranking therefore uses the unclipped score, which preserves the order
        clipping would flatten.
        """
        s = (
            self.global_mean
            + self._ub[user_idx]
            + self._ib
            + self._uf[user_idx] @ self._if.T
        )
        return np.clip(s, RATING_MIN, RATING_MAX) if clip else s

    def rated_items(self, user_idx):
        """Indices and ratings of the items this user rated in training.

        The previous version tried to recover this with
        np.nonzero(item_factors @ user_vector), which is a dense dot product and
        so returned every item in the catalogue. The interaction matrix is now
        stored in the model file, so the history is exact.
        """
        row = self._train.getrow(user_idx)
        return row.indices, row.data

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

    def hybrid_scores(self, user_idx, alpha=None, clip=False):
        """Blended score for every item. clip=False by default: this is the
        ranking path, and see collaborative_scores for why ranking must not
        clip. Pass clip=True only when the number is read as a rating.
        """
        a = self.alpha if alpha is None else float(alpha)
        rated_idx, rated_vals = self.rated_items(user_idx)
        collab = self.collaborative_scores(user_idx, clip=clip)
        content = self.content_scores(user_idx, rated_idx, rated_vals)
        return a * collab + (1.0 - a) * content, rated_idx

    # ---------------------------------------------------------------- public

    def recommend(self, user_id, top_n=10, alpha=None, exclude_rated=True):
        """Top-N item ids with scores, highest first."""
        if user_id not in self.user_to_idx:
            raise KeyError(user_id)
        user_idx = self.user_to_idx[user_id]
        scores, rated_idx = self.hybrid_scores(user_idx, alpha)

        if exclude_rated and len(rated_idx):
            # Recommending back what someone already bought is the most visible
            # failure mode a recommender has.
            scores = scores.copy()
            scores[rated_idx] = -np.inf

        n = min(top_n, self.n_items)
        # argpartition finds the top n without sorting all n_items.
        part = np.argpartition(scores, -n)[-n:]
        order = part[np.argsort(scores[part])[::-1]]
        return [(str(self.item_ids[i]), float(scores[i])) for i in order]

    def predict(self, user_idx, item_idx, alpha=None):
        """Predicted rating for one user-item pair, for RMSE."""
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
