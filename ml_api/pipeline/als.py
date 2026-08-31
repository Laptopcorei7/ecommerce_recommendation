"""Implicit-feedback alternating least squares.

Hu, Koren and Volinsky (2008), "Collaborative Filtering for Implicit Feedback
Datasets". Implemented here rather than pulled from a library because it is
forty lines and the choice of objective is the whole point of this module.

Why this replaces truncated SVD for ranking
-------------------------------------------
`scipy.svds` factorizes the rating matrix with every unobserved cell treated as
a zero. At 0.0159% density that is 99.98% of the objective, so the factors are
crushed toward nothing: measured on the previous model, item_bias had a standard
deviation of 0.2281 against 0.0017 for the personalized term. The ranking was
99% a single global ordering, identical for every user.

ALS fixes two things at once. It only fits observed entries, weighting the
unobserved ones with a low but non-zero confidence rather than treating them as
hard zeros. And its objective is preference (did this interaction happen) rather
than rating value, which is what a top-N ranking actually needs. Optimizing RMSE
and optimizing ranking are different problems, and this project needs both, so
the explicit factorization is kept alongside for rating prediction.

The rating is used as a confidence signal, not a target: a 5-star interaction is
stronger evidence of preference than a 1-star one, but both are evidence that
the user chose to engage with the item at all.
"""

from __future__ import annotations

import time

import numpy as np


def _solve_side(fixed, Cui_indptr, Cui_indices, Cui_data, n, reg, out):
    """One half-iteration: solve for every row of `out`, holding `fixed`.

    For row u with observed columns I and confidences c:

        A = FᵀF + Fᵢᵀ diag(c - 1) Fᵢ + reg·I
        b = Fᵢᵀ c

    FᵀF is shared across all rows and computed once. The per-row correction
    touches only that row's handful of observed columns, so each solve is a
    k×k system built from a tiny matmul rather than anything the size of the
    catalogue.
    """
    k = fixed.shape[1]
    FtF = fixed.T @ fixed
    reg_eye = reg * np.eye(k, dtype=np.float64)
    base = FtF + reg_eye

    for row in range(n):
        start, stop = Cui_indptr[row], Cui_indptr[row + 1]
        if start == stop:
            out[row] = 0.0
            continue
        idx = Cui_indices[start:stop]
        conf = Cui_data[start:stop]
        F = fixed[idx]                       # (n_obs, k)
        # (c - 1) weighting: the base already accounts for a confidence of 1
        # on every cell, so only the surplus is added here.
        A = base + F.T @ (F * (conf - 1.0)[:, None])
        b = F.T @ conf
        try:
            out[row] = np.linalg.solve(A, b)
        except np.linalg.LinAlgError:
            out[row] = np.linalg.lstsq(A, b, rcond=None)[0]


def fit_als(mat, n_factors=64, iterations=15, reg=0.05, confidence=40.0,
            seed=42, log=print):
    """Factorize a user-item matrix by implicit ALS.

    mat         CSR of observed ratings (values are ratings, not preferences)
    confidence  scales how much an observation outweighs a non-observation

    Returns (user_factors, item_factors), both float32.
    """
    n_users, n_items = mat.shape
    csr = mat.tocsr()
    csc = mat.tocsc()

    # Confidence c = 1 + confidence * (rating / 5). A one-star interaction still
    # counts as engagement, a five-star one counts more.
    cu = (1.0 + confidence * (csr.data.astype(np.float64) / 5.0))
    ci = (1.0 + confidence * (csc.data.astype(np.float64) / 5.0))

    rng = np.random.default_rng(seed)
    U = rng.normal(0, 0.01, (n_users, n_factors))
    V = rng.normal(0, 0.01, (n_items, n_factors))

    log("  ALS k={} iters={} reg={} confidence={}".format(
        n_factors, iterations, reg, confidence))
    t0 = time.time()
    for it in range(1, iterations + 1):
        _solve_side(V, csr.indptr, csr.indices, cu, n_users, reg, U)
        _solve_side(U, csc.indptr, csc.indices, ci, n_items, reg, V)
        if it == 1 or it % 5 == 0 or it == iterations:
            el = time.time() - t0
            log("    iter {}/{}  ({:.0f}s elapsed, ~{:.0f}s left)".format(
                it, iterations, el, el / it * (iterations - it)))

    # A quick health check on the thing that was broken before: the personalized
    # term must actually vary across items for a given user.
    probe = rng.choice(n_users, min(200, n_users), replace=False)
    spread = float(np.mean([(U[u] @ V.T).std() for u in probe]))
    log("    personalized score spread {:.4f} (SVD produced 0.0017)".format(spread))

    return U.astype(np.float32), V.astype(np.float32)
