"""Tests for the data pipeline's pure functions.

These need no corpus and no trained model. The k-core and sampling tests matter
because both were done wrong in the original: the filter ran a single pass, and
the 500k-row sample was taken over rows rather than users, which shreds the
interaction histories the collaborative model learns from.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from ml_api.pipeline.als import fit_als
from ml_api.pipeline.build_dataset import (
    _clean_price,
    _first_image,
    _keep_user,
    iterative_kcore,
    sample_users,
)


def frame(pairs):
    return pd.DataFrame(
        [{"user_id": u, "parent_asin": i, "rating": 5.0, "timestamp": n}
         for n, (u, i) in enumerate(pairs)])


# --- k-core -----------------------------------------------------------------

def test_kcore_output_actually_satisfies_kcore():
    """The original ran one pass, which does not converge: dropping thin items
    pushes users under the threshold, which drops further items."""
    rng = np.random.default_rng(0)
    pairs = [("u{}".format(u), "i{}".format(i))
             for u in range(40) for i in rng.choice(30, 8, replace=False)]
    # A tail that only a repeated pass can fully remove.
    pairs += [("rare{}".format(n), "orphan{}".format(n)) for n in range(25)]
    out = iterative_kcore(frame(pairs), 5, 5, 20)
    assert len(out) > 0
    assert out["user_id"].value_counts().min() >= 5
    assert out["parent_asin"].value_counts().min() >= 5


def test_kcore_is_idempotent():
    """Running it again on its own output must change nothing."""
    rng = np.random.default_rng(1)
    pairs = [("u{}".format(u), "i{}".format(i))
             for u in range(50) for i in rng.choice(25, 9, replace=False)]
    once = iterative_kcore(frame(pairs), 5, 5, 20)
    twice = iterative_kcore(once, 5, 5, 20)
    assert len(once) == len(twice)


def test_kcore_raises_rather_than_returning_nothing():
    with pytest.raises(SystemExit):
        iterative_kcore(frame([("u1", "i1"), ("u2", "i2")]), 5, 5, 20)


def test_a_single_pass_would_not_have_been_enough():
    """Guards the reason the loop exists. One pass leaves violations behind."""
    rng = np.random.default_rng(7)
    pairs = [("u{}".format(u), "i{}".format(i))
             for u in range(30) for i in rng.choice(20, 7, replace=False)]
    pairs += [("thin{}".format(n), "i{}".format(n % 20)) for n in range(40)]
    df = frame(pairs)
    one_pass = iterative_kcore(df, 5, 5, 1)
    converged = iterative_kcore(df, 5, 5, 20)
    assert len(converged) <= len(one_pass)
    assert converged["user_id"].value_counts().min() >= 5


# --- sampling ---------------------------------------------------------------

def test_user_sampling_is_stable_across_calls():
    """A hash, not a random draw: the same rate must select the same users on
    any machine, or a rebuild is not reproducible."""
    users = ["user-{}".format(n) for n in range(2000)]
    first = {u for u in users if _keep_user(u, 0.3)}
    second = {u for u in users if _keep_user(u, 0.3)}
    assert first == second
    assert 0.25 < len(first) / len(users) < 0.35


def test_a_higher_rate_is_a_superset_of_a_lower_one():
    users = ["user-{}".format(n) for n in range(2000)]
    small = {u for u in users if _keep_user(u, 0.2)}
    large = {u for u in users if _keep_user(u, 0.5)}
    assert small.issubset(large)


def test_sampling_keeps_whole_user_histories():
    """Sampling rows instead of users is what destroys histories. Every kept
    user must arrive with all of their interactions."""
    df = frame([("u{}".format(u), "i{}".format(i))
                for u in range(200) for i in range(6)])
    out = sample_users(df, 0.5)
    for uid, group in out.groupby("user_id"):
        assert len(group) == 6


# --- metadata parsing -------------------------------------------------------

@pytest.mark.parametrize("raw,want", [
    ("$19.99", 19.99), ("19.99", 19.99), ("$1,299.00", 1299.0),
    (24.5, 24.5), ("$10.00 - $20.00", 10.0),
    (None, None), ("", None), ("None", None), (0, None), (-5, None),
    ("from $12", None),
])
def test_price_parsing(raw, want):
    got = _clean_price(raw)
    if want is None:
        assert got is None
    else:
        assert got == pytest.approx(want)


def test_first_image_prefers_large_over_thumb():
    images = {"thumb": ["t.jpg"], "large": ["l.jpg"], "hi_res": ["h.jpg"]}
    assert _first_image(images) == "l.jpg"


def test_first_image_handles_the_list_of_dicts_shape():
    """The real file uses this shape, not the dict-of-lists one."""
    assert _first_image([{"thumb": "t.jpg", "large": "l.jpg"}]) == "l.jpg"


@pytest.mark.parametrize("bad", [None, [], {}, [{}], {"large": []}])
def test_first_image_returns_none_rather_than_raising(bad):
    assert _first_image(bad) is None


# --- ALS --------------------------------------------------------------------

def test_als_learns_a_block_structure():
    """bug-007 in miniature. Two disjoint groups of users and items; ALS must
    score a user's own block above the other one. Plain SVD on this matrix
    produced a single global ordering instead."""
    import scipy.sparse as sp
    rows, cols = [], []
    for u in range(20):
        block = range(0, 10) if u < 10 else range(10, 20)
        for i in block:
            rows.append(u)
            cols.append(i)
    mat = sp.csr_matrix(
        (np.full(len(rows), 5.0, np.float32), (rows, cols)), shape=(20, 20))

    U, V = fit_als(mat, n_factors=8, iterations=12, reg=0.05,
                   confidence=40.0, seed=0, log=lambda *_: None)

    own = (U[0] @ V[:10].T).mean()
    other = (U[0] @ V[10:].T).mean()
    assert own > other

    # And the two groups must not receive the same ranking.
    assert not np.allclose(U[0] @ V.T, U[19] @ V.T)


def test_als_is_deterministic_for_a_seed():
    import scipy.sparse as sp
    mat = sp.csr_matrix(np.eye(12, dtype=np.float32) * 5.0)
    a = fit_als(mat, 4, 5, 0.05, 40.0, seed=3, log=lambda *_: None)
    b = fit_als(mat, 4, 5, 0.05, 40.0, seed=3, log=lambda *_: None)
    assert np.allclose(a[0], b[0]) and np.allclose(a[1], b[1])


def test_als_handles_a_user_with_no_interactions():
    import scipy.sparse as sp
    m = np.zeros((6, 6), np.float32)
    m[1:, 1:] = 5.0
    U, V = fit_als(sp.csr_matrix(m), 3, 5, 0.05, 40.0, seed=0, log=lambda *_: None)
    assert np.all(np.isfinite(U)) and np.all(np.isfinite(V))
    assert np.allclose(U[0], 0.0)
