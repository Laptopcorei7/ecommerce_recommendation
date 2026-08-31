"""Quality gates on the real trained model.

Everything here skips when ml_api/artifacts/ is absent, so a fresh clone still
has a green suite. Run them after a retrain:

    pytest -m trained

These are the checks that would have caught the two defects the original
evaluation could not see: a collaborative half that ranked no better than
random, and a hybrid that lost to a popularity baseline. They assert properties
rather than exact numbers, so an improved model does not fail them, but a
regression to a non-personalized global ordering does.
"""

from __future__ import annotations

import numpy as np
import pytest

from ml_api.pipeline import config as cfg

pytestmark = pytest.mark.trained

pytest.importorskip("pandas")


def _require_artifacts():
    if not cfg.MODEL_NPZ.exists():
        pytest.skip("no trained model; run ml_api.pipeline.train")
    if not cfg.HOLDOUT_PARQUET.exists():
        pytest.skip("no holdout; run ml_api.pipeline.build_dataset")


@pytest.fixture(scope="module")
def trained():
    _require_artifacts()
    from ml_api.model_loader import load_model
    from ml_api.recommender import HybridRecommender
    return HybridRecommender(load_model(cfg.MODEL_NPZ), alpha=cfg.ALPHA)


@pytest.fixture(scope="module")
def test_items(trained):
    import pandas as pd
    hold = pd.read_parquet(cfg.HOLDOUT_PARQUET)
    test = hold[hold["split"] == "test"]
    by_user = test.groupby("user_id")["parent_asin"].apply(list).to_dict()
    return {u: v for u, v in by_user.items() if u in trained.user_to_idx}


def _hit_rate(eng, by_user, score_fn, k=10, n_users=1500, seed=42):
    rng = np.random.default_rng(seed)
    users = list(by_user.keys())
    if len(users) > n_users:
        users = [users[i] for i in rng.choice(len(users), n_users, replace=False)]
    i_idx = eng.m["item_to_idx"]
    hits = n = 0
    for uid in users:
        truth = {i_idx[a] for a in by_user[uid] if a in i_idx}
        if not truth:
            continue
        u = eng.user_to_idx[uid]
        s = np.asarray(score_fn(u), dtype=float).copy()
        s[eng.rated_items(u)[0]] = -np.inf
        top = np.argpartition(s, -k)[-k:]
        hits += len(truth & set(top.tolist())) > 0
        n += 1
    return hits / max(n, 1)


# --- the gate that matters --------------------------------------------------

def test_the_model_beats_a_popularity_baseline(trained, test_items):
    """The check that was missing while the ranking was broken. A recommender
    that cannot beat 'show the most popular items' has not earned its
    complexity."""
    pop = np.asarray((trained.m["train_matrix"] > 0).sum(axis=0)).ravel().astype(float)
    popularity = _hit_rate(trained, test_items, lambda u: pop)
    hybrid = _hit_rate(trained, test_items, lambda u: trained.hybrid_scores(u)[0])
    assert hybrid > popularity, (
        "hybrid {:.4f} does not beat popularity {:.4f}".format(hybrid, popularity))


def test_the_collaborative_half_beats_random(trained, test_items):
    """bug-007: with truncated SVD this scored 0.0003 against random's 0.0003."""
    rng = np.random.default_rng(0)
    collab = _hit_rate(trained, test_items, lambda u: trained.preference_scores(u))
    random = _hit_rate(trained, test_items, lambda u: rng.random(trained.n_items))
    assert collab > random * 5


# --- personalization --------------------------------------------------------

def test_the_ranking_is_not_one_global_ordering(trained):
    """bug-007's signature: every user received the same top-N, because the
    personalized term was 0.7% the size of item_bias."""
    users = [str(u) for u in trained.m["user_ids"][:25]]
    tops = {tuple(i for i, _ in trained.recommend(u, top_n=10)) for u in users}
    assert len(tops) > len(users) * 0.7, "users are receiving near-identical lists"


def test_the_personalized_term_is_not_swamped_by_item_bias(trained):
    """Guards the exact ratio that made the SVD model useless: 0.0017 against
    0.2281, a ratio of 0.007."""
    rng = np.random.default_rng(0)
    probe = rng.choice(len(trained.m["als_user_factors"]), 100, replace=False)
    spread = float(np.mean([trained.preference_scores(u).std() for u in probe]))
    assert spread > 0.005, "personalized signal has collapsed ({:.5f})".format(spread)


def test_users_with_different_histories_get_different_recommendations(trained):
    a, b = [str(u) for u in trained.m["user_ids"][:2]]
    assert ([i for i, _ in trained.recommend(a, top_n=10)]
            != [i for i, _ in trained.recommend(b, top_n=10)])


# --- the other regressions, on real data ------------------------------------

def test_no_mass_ties_at_the_top(trained):
    """bug-006: clipping tied 4,433 items at exactly 5.0 for one real user."""
    for uid in [str(u) for u in trained.m["user_ids"][:10]]:
        scores = [s for _, s in trained.recommend(uid, top_n=20)]
        assert len(set(scores)) >= 19


def test_recommendations_exclude_the_users_own_history(trained):
    for uid in [str(u) for u in trained.m["user_ids"][:20]]:
        u = trained.user_to_idx[uid]
        rated = {str(trained.item_ids[i]) for i in trained.rated_items(u)[0]}
        got = {i for i, _ in trained.recommend(uid, top_n=50)}
        assert not (got & rated)


def test_history_is_a_history_not_the_whole_catalogue(trained):
    """bug-001 on real data: this returned all 19,278 items."""
    for u in range(50):
        idx, _ = trained.rated_items(u)
        assert 0 < len(idx) < trained.n_items * 0.01


def test_both_halves_move_the_ranking(trained):
    """bug-003: one half was too small to affect the result at any alpha."""
    u = trained.user_to_idx[str(trained.m["user_ids"][0])]
    collab, _ = trained.hybrid_scores(u, alpha=1.0)
    content, _ = trained.hybrid_scores(u, alpha=0.0)
    mixed, _ = trained.hybrid_scores(u, alpha=0.5)
    assert not np.allclose(collab, content)
    assert not np.allclose(mixed, collab)


def test_rating_predictions_stay_on_the_scale(trained):
    rng = np.random.default_rng(1)
    for u in rng.choice(len(trained.m["user_ids"]), 30, replace=False):
        for i in rng.choice(trained.n_items, 5, replace=False):
            assert 1.0 <= trained.predict(int(u), int(i)) <= 5.0


def test_a_recommendation_is_fast_enough_to_serve(trained):
    import time
    uid = str(trained.m["user_ids"][0])
    trained.recommend(uid, top_n=10)          # warm
    t0 = time.perf_counter()
    for _ in range(10):
        trained.recommend(uid, top_n=10)
    per_call_ms = (time.perf_counter() - t0) / 10 * 1000
    assert per_call_ms < 250, "{:.0f}ms per recommendation".format(per_call_ms)


# --- catalogue coverage -----------------------------------------------------

def test_every_recommended_item_has_metadata_to_render(trained):
    """F-15 was the absence of this. A recommendation the storefront cannot
    display is not a working recommendation."""
    from ml_api.model_loader import load_catalog
    if not cfg.SERVED_CATALOG.exists():
        pytest.skip("no served catalogue")
    catalog = load_catalog(cfg.SERVED_CATALOG)
    for uid in [str(u) for u in trained.m["user_ids"][:20]]:
        for item_id, _ in trained.recommend(uid, top_n=10):
            assert item_id in catalog
            assert catalog[item_id].get("title")


def test_the_served_catalogue_does_not_carry_training_text(trained):
    """The text field is TF-IDF input, up to 5000 characters per item. Shipping
    it made the served catalogue 109MB of data the API never reads."""
    from ml_api.model_loader import load_catalog
    if not cfg.SERVED_CATALOG.exists():
        pytest.skip("no served catalogue")
    catalog = load_catalog(cfg.SERVED_CATALOG)
    assert all("text" not in rec for rec in list(catalog.values())[:200])
