"""Shared fixtures.

Everything here builds a small synthetic model from scratch. The tests must run
on a fresh clone, where the 2GB corpus and the trained model do not exist, so
nothing in the fast suite may depend on `ml_api/artifacts/`. Tests that need the
real trained model live in test_trained_model.py and skip themselves when it is
absent.
"""

from __future__ import annotations

import json

import numpy as np
import pytest
import scipy.sparse as sp

N_USERS = 6
N_ITEMS = 8
N_FACTORS = 3
GLOBAL_MEAN = 4.0


def build_arrays(seed=0, n_users=N_USERS, n_items=N_ITEMS, k=N_FACTORS):
    """A deliberately structured toy model.

    Users 0-2 rate the first half of the catalogue, users 3-5 the second half,
    so a correct recommender should keep those groups apart. Content similarity
    mirrors that split, so the content half agrees with the collaborative half
    rather than fighting it.
    """
    rng = np.random.default_rng(seed)
    item_ids = np.array(["ITEM{:02d}".format(i) for i in range(n_items)], dtype=object)
    user_ids = np.array(["USER{:02d}".format(u) for u in range(n_users)], dtype=object)

    half = n_items // 2
    rows, cols, vals = [], [], []
    for u in range(n_users):
        block = range(0, half) if u < n_users // 2 else range(half, n_items)
        # Leave one item per block unrated, so there is something to recommend.
        for i in list(block)[:-1]:
            rows.append(u)
            cols.append(i)
            vals.append(float(rng.integers(3, 6)))
    train = sp.csr_matrix(
        (np.array(vals, np.float32), (rows, cols)), shape=(n_users, n_items))

    # Content similarity: strong within each half, zero across. Diagonal empty,
    # because an item is not its own neighbour.
    crow, ccol, cval = [], [], []
    for i in range(n_items):
        for j in range(n_items):
            if i == j:
                continue
            same = (i < half) == (j < half)
            if same:
                crow.append(i)
                ccol.append(j)
                cval.append(0.8)
    content = sp.csr_matrix(
        (np.array(cval, np.float32), (crow, ccol)), shape=(n_items, n_items))

    return {
        "format_version": np.int32(3),
        "item_ids": item_ids,
        "user_ids": user_ids,
        "user_factors": rng.normal(0, 0.3, (n_users, k)).astype(np.float32),
        "item_factors": rng.normal(0, 0.3, (n_items, k)).astype(np.float32),
        "als_user_factors": rng.normal(0, 0.3, (n_users, k)).astype(np.float32),
        "als_item_factors": rng.normal(0, 0.3, (n_items, k)).astype(np.float32),
        "user_bias": rng.normal(0, 0.1, n_users).astype(np.float32),
        "item_bias": rng.normal(0, 0.1, n_items).astype(np.float32),
        "sigma": np.ones(k, np.float32),
        "global_mean": np.float32(GLOBAL_MEAN),
        "alpha": np.float32(0.7),
        "n_factors": np.int32(k),
        "content_data": content.data,
        "content_indices": content.indices,
        "content_indptr": content.indptr,
        "content_shape": np.array(content.shape, np.int64),
        "train_data": train.data,
        "train_indices": train.indices,
        "train_indptr": train.indptr,
        "train_shape": np.array(train.shape, np.int64),
    }


def write_npz(path, **overrides):
    """Write a model file, optionally corrupting a field to test the guards."""
    arrays = build_arrays()
    arrays.update(overrides)
    np.savez_compressed(path, **arrays)
    return path


@pytest.fixture
def model_path(tmp_path):
    return write_npz(tmp_path / "model.npz")


@pytest.fixture
def model(model_path):
    from ml_api.model_loader import load_model
    return load_model(model_path)


@pytest.fixture
def engine(model):
    from ml_api.recommender import HybridRecommender
    return HybridRecommender(model)


@pytest.fixture
def catalog_path(tmp_path):
    path = tmp_path / "catalog.jsonl"
    with open(path, "w", encoding="utf-8") as fh:
        for i in range(N_ITEMS):
            fh.write(json.dumps({
                "id": "ITEM{:02d}".format(i),
                "title": "Test Product {}".format(i),
                "price": 10.0 + i,
                "image": "https://example.invalid/{}.jpg".format(i),
                "store": "Test Store",
                "categories": ["Electronics"],
                "average_rating": 4.5,
                "rating_number": 100 + i,
            }) + "\n")
    return path
