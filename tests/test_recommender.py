"""Regression tests for the defects that made the original model non-functional.

Each test here names the bug it prevents. They are written against a synthetic
model, so they check behaviour rather than quality; quality is measured in
test_trained_model.py against the real artefacts.
"""

from __future__ import annotations

import numpy as np
import pytest

from ml_api.recommender import RATING_MAX, RATING_MIN, HybridRecommender, _standardize

from .conftest import GLOBAL_MEAN, N_ITEMS


# --- bug-001: the user's history was not in the model file ------------------

def test_rated_items_returns_the_history_not_the_catalogue(engine):
    """The original recovered history with np.nonzero(item_factors @ user_vector),
    a dense dot product that returns every item. Each synthetic user rates three
    of eight, so anything near N_ITEMS means the bug is back."""
    for u in range(len(engine.m["user_ids"])):
        idx, vals = engine.rated_items(u)
        assert 0 < len(idx) < N_ITEMS
        assert len(idx) == len(vals)
        assert set(idx).issubset(range(N_ITEMS))


def test_content_scores_differ_between_users(engine):
    """The exact symptom of bug-001: every user got an identical constant vector."""
    a = engine.content_scores(0)
    b = engine.content_scores(len(engine.m["user_ids"]) - 1)
    assert not np.allclose(a, b)


def test_content_scores_fall_back_to_the_global_mean_with_no_history(model):
    """A user with an empty row must not produce NaN."""
    model["train_matrix"] = model["train_matrix"].copy()
    model["train_matrix"][0] = 0
    model["train_matrix"].eliminate_zeros()
    eng = HybridRecommender(model)
    scores = eng.content_scores(0)
    assert np.all(np.isfinite(scores))
    assert np.allclose(scores, GLOBAL_MEAN)


def test_content_scores_stay_on_the_rating_scale(engine):
    """It is a weighted average of observed ratings, so it is bounded by
    construction. If this fails the weighting is wrong, not the clipping."""
    for u in range(len(engine.m["user_ids"])):
        s = engine.content_scores(u)
        assert np.all(np.isfinite(s))
        assert s.min() >= RATING_MIN - 1e-6
        assert s.max() <= RATING_MAX + 1e-6


# --- bug-006: clipping the ranking path tied thousands of items -------------

def test_ranking_does_not_clip(engine):
    """Clipping ranking scores to [1, 5] tied 4,433 items at exactly 5.0 for one
    real user, making the top-N an arbitrary pick among them."""
    raw = engine.rating_scores(0, clip=False)
    clipped = engine.rating_scores(0, clip=True)
    assert np.all(clipped >= RATING_MIN) and np.all(clipped <= RATING_MAX)
    # The unclipped path must be free to leave the scale.
    assert raw.dtype.kind == "f"
    assert np.allclose(clipped, np.clip(raw, RATING_MIN, RATING_MAX))


def test_recommendation_scores_are_distinct(engine):
    """Mass ties are the observable symptom of bug-006."""
    scores = [s for _, s in engine.recommend("USER00", top_n=4)]
    assert len(set(scores)) == len(scores)


def test_predict_still_clips_because_rmse_needs_it(engine):
    for u in range(len(engine.m["user_ids"])):
        for i in range(N_ITEMS):
            p = engine.predict(u, i)
            assert RATING_MIN - 1e-6 <= p <= RATING_MAX + 1e-6


# --- bug-003 / bug-007: one half of the blend doing nothing -----------------

def test_standardize_preserves_order(engine):
    v = np.array([3.0, 1.0, 2.0, 10.0])
    assert list(np.argsort(_standardize(v))) == list(np.argsort(v))


def test_standardize_survives_a_constant_vector():
    out = _standardize(np.full(5, 2.0))
    assert np.all(np.isfinite(out)) and np.allclose(out, 0.0)


def test_both_halves_influence_the_ranking(engine):
    """bug-003 was a blend where one half could not move the result at any alpha.
    The two extremes must therefore disagree."""
    collab_only, _ = engine.hybrid_scores(0, alpha=1.0)
    content_only, _ = engine.hybrid_scores(0, alpha=0.0)
    assert not np.allclose(collab_only, content_only)
    mixed, _ = engine.hybrid_scores(0, alpha=0.5)
    assert not np.allclose(mixed, collab_only)
    assert not np.allclose(mixed, content_only)


def test_alpha_of_one_is_exactly_the_preference_scores(engine):
    scores, _ = engine.hybrid_scores(0, alpha=1.0)
    assert np.allclose(scores, _standardize(engine.preference_scores(0)))


def test_preference_scores_are_personalized(engine):
    """bug-007: the ranking collapsed to one global ordering shared by everyone."""
    first = engine.preference_scores(0)
    other = engine.preference_scores(len(engine.m["user_ids"]) - 1)
    assert not np.allclose(first, other)
    assert list(np.argsort(first)) != list(np.argsort(other))


# --- F-05: recommending back what someone already has -----------------------

def test_recommend_excludes_already_rated_items(engine):
    for uid in [str(u) for u in engine.m["user_ids"]]:
        u = engine.user_to_idx[uid]
        rated = {str(engine.item_ids[i]) for i in engine.rated_items(u)[0]}
        got = {i for i, _ in engine.recommend(uid, top_n=N_ITEMS)}
        assert not (got & rated)


def test_exclude_rated_can_be_turned_off(engine):
    with_rated = engine.recommend("USER00", top_n=N_ITEMS, exclude_rated=False)
    without = engine.recommend("USER00", top_n=N_ITEMS, exclude_rated=True)
    assert len(with_rated) > len(without)


# --- ordering and contract --------------------------------------------------

def test_recommendations_are_sorted_high_to_low(engine):
    scores = [s for _, s in engine.recommend("USER00", top_n=4)]
    assert scores == sorted(scores, reverse=True)


def test_top_n_is_capped_at_the_catalogue_size(engine):
    assert len(engine.recommend("USER00", top_n=999, exclude_rated=False)) == N_ITEMS


def test_recommend_returns_real_item_ids(engine):
    valid = set(str(a) for a in engine.item_ids)
    assert all(i in valid for i, _ in engine.recommend("USER00", top_n=4))


def test_unknown_user_raises_keyerror(engine):
    with pytest.raises(KeyError):
        engine.recommend("NOPE")


def test_alpha_comes_from_the_caller_when_given(model):
    """config.ALPHA is the source of truth at serve time, so an explicit alpha
    must beat the value stored in the model file."""
    assert HybridRecommender(model).alpha == pytest.approx(0.7)
    assert HybridRecommender(model, alpha=0.25).alpha == pytest.approx(0.25)


def test_scoring_is_deterministic(engine):
    assert engine.recommend("USER00", top_n=5) == engine.recommend("USER00", top_n=5)


def test_the_group_structure_is_learned_from_content(engine):
    """Users 0-2 rate the first half, users 3-5 the second. With alpha=0 the
    ranking is pure content, and content similarity is block-diagonal, so the
    unrated item from a user's own block must come out on top."""
    top = engine.recommend("USER00", top_n=1, alpha=0.0)[0][0]
    assert top in {"ITEM00", "ITEM01", "ITEM02", "ITEM03"}


# --- score breakdown --------------------------------------------------------
#
# The storefront shows which half of the blend drove each placement, so the
# halves have to be reported as what they actually are.

def test_recommend_and_recommend_detailed_agree(engine):
    """recommend() is written in terms of recommend_detailed(). If they ever
    disagree, the storefront is explaining a ranking it is not showing."""
    plain = engine.recommend("USER00", top_n=4)
    detailed = engine.recommend_detailed("USER00", top_n=4)
    assert [i for i, _ in plain] == [d["id"] for d in detailed]
    for (_, score), d in zip(plain, detailed):
        assert score == pytest.approx(d["score"])


def test_the_halves_sum_to_the_score(engine):
    """They are the weighted terms, not the raw ones, so the sum is the score
    and the larger of the two is the half that decided the placement."""
    for d in engine.recommend_detailed("USER00", top_n=4):
        assert d["collaborative"] + d["content"] == pytest.approx(d["score"])


def test_alpha_moves_weight_between_the_halves(engine):
    at_one = engine.recommend_detailed("USER00", top_n=1, alpha=1.0)[0]
    at_zero = engine.recommend_detailed("USER00", top_n=1, alpha=0.0)[0]
    assert at_one["content"] == 0.0
    assert at_zero["collaborative"] == 0.0


def test_score_halves_are_standardized(engine):
    """Blending two halves on different scales was the original bug: a
    collaborative term spanning 4.0 was added to a content term spanning 0.028,
    so the content half could not move the ranking at any alpha."""
    pref, content, _ = engine.score_halves(0)
    for half in (pref, content):
        # Tolerances are float32-sized: the factors are stored as float32, so
        # a mean of 3e-08 is exactly zero as far as this arithmetic goes.
        assert half.mean() == pytest.approx(0.0, abs=1e-6)
        assert half.std() == pytest.approx(1.0, abs=1e-6)


# --- similar items ----------------------------------------------------------

def test_similar_items_never_include_the_item_itself(engine):
    """An item is trivially its own nearest neighbour, which is not a
    recommendation."""
    for item_id in ["ITEM00", "ITEM07"]:
        assert item_id not in [i for i, _ in engine.similar_items(item_id, k=5)]


def test_similar_items_are_ordered_by_similarity(engine):
    scores = [s for _, s in engine.similar_items("ITEM00", k=4)]
    assert scores == sorted(scores, reverse=True)


def test_similar_items_respect_the_content_structure(engine):
    """The fixture's similarity is strong within each half of the catalogue and
    zero across it, so neighbours of an early item must stay in that half."""
    neighbours = [i for i, _ in engine.similar_items("ITEM00", k=3)]
    assert all(int(i[-2:]) < 4 for i in neighbours)


def test_similar_items_caps_at_what_exists(engine):
    """Asking for more neighbours than the matrix holds must not pad the result
    with zeros or raise."""
    assert len(engine.similar_items("ITEM00", k=99)) == 3


def test_similar_items_rejects_an_unknown_item(engine):
    with pytest.raises(KeyError):
        engine.similar_items("NOT_AN_ITEM")
