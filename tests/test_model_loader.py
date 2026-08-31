"""The loader's job is to refuse a model file that lies about its own shape.

A model with two conflicting item orderings served wrong recommendations for
months without anything failing (bug-002). These tests exist so that a file
whose item-indexed arrays disagree can never load again.
"""

from __future__ import annotations

import numpy as np
import pytest

from ml_api.model_loader import ModelFormatError, load_catalog, load_model

from .conftest import N_ITEMS, N_USERS, write_npz


def test_loads_a_well_formed_model(model):
    assert len(model["item_ids"]) == N_ITEMS
    assert len(model["user_ids"]) == N_USERS
    assert model["content_sim"].shape == (N_ITEMS, N_ITEMS)
    assert model["train_matrix"].shape == (N_USERS, N_ITEMS)


def test_index_maps_are_derived_not_stored(model_path):
    """A stored mapping is a second ordering that can drift. bug-002 was exactly
    that, so the loader must build the maps from item_ids every time."""
    with np.load(model_path, allow_pickle=True) as raw:
        assert "item_to_idx" not in raw.files
        assert "content_item_to_idx" not in raw.files
    model = load_model(model_path)
    assert model["item_to_idx"] == {str(a): i for i, a in enumerate(model["item_ids"])}


def test_missing_file_explains_how_to_build_one(tmp_path):
    with pytest.raises(ModelFormatError) as err:
        load_model(tmp_path / "nope.npz")
    assert "build_dataset" in str(err.value)


def test_rejects_an_unsupported_format_version(tmp_path):
    path = write_npz(tmp_path / "old.npz", format_version=np.int32(2))
    with pytest.raises(ModelFormatError, match="format v2"):
        load_model(path)


# --- the ordering invariants, one test per array that must match item_ids ---

@pytest.mark.parametrize("field,bad", [
    ("item_factors", np.zeros((N_ITEMS - 1, 3), np.float32)),
    ("item_bias", np.zeros(N_ITEMS + 2, np.float32)),
    ("als_item_factors", np.zeros((N_ITEMS - 1, 3), np.float32)),
])
def test_rejects_item_indexed_array_of_the_wrong_length(tmp_path, field, bad):
    path = write_npz(tmp_path / "bad.npz", **{field: bad})
    with pytest.raises(ModelFormatError, match="invariants"):
        load_model(path)


@pytest.mark.parametrize("field,bad", [
    ("user_factors", np.zeros((N_USERS + 3, 3), np.float32)),
    ("user_bias", np.zeros(N_USERS - 1, np.float32)),
    ("als_user_factors", np.zeros((N_USERS + 3, 3), np.float32)),
])
def test_rejects_user_indexed_array_of_the_wrong_length(tmp_path, field, bad):
    path = write_npz(tmp_path / "bad.npz", **{field: bad})
    with pytest.raises(ModelFormatError, match="invariants"):
        load_model(path)


def test_rejects_a_content_matrix_that_is_not_square_over_the_items(tmp_path):
    """The shape that carried bug-002: content similarity built over a different
    item set than the factors."""
    path = write_npz(
        tmp_path / "bad.npz",
        content_shape=np.array([N_ITEMS - 1, N_ITEMS - 1], np.int64),
        content_indptr=np.zeros(N_ITEMS, np.int32),
        content_indices=np.array([], np.int32),
        content_data=np.array([], np.float32),
    )
    with pytest.raises(ModelFormatError, match="invariants"):
        load_model(path)


def test_rejects_alpha_outside_the_unit_interval(tmp_path):
    path = write_npz(tmp_path / "bad.npz", alpha=np.float32(1.4))
    with pytest.raises(ModelFormatError, match="alpha"):
        load_model(path)


def test_error_names_every_broken_field_at_once(tmp_path):
    """A report naming one problem at a time makes a bad export a guessing game."""
    path = write_npz(
        tmp_path / "bad.npz",
        item_bias=np.zeros(N_ITEMS + 1, np.float32),
        user_bias=np.zeros(N_USERS + 1, np.float32),
    )
    with pytest.raises(ModelFormatError) as err:
        load_model(path)
    assert "item_bias" in str(err.value) and "user_bias" in str(err.value)


# --- catalogue ---

def test_loads_the_catalogue_keyed_by_item_id(catalog_path):
    catalog = load_catalog(catalog_path)
    assert len(catalog) == N_ITEMS
    assert catalog["ITEM00"]["title"] == "Test Product 0"


def test_missing_catalogue_explains_how_to_build_one(tmp_path):
    with pytest.raises(ModelFormatError) as err:
        load_catalog(tmp_path / "nope.jsonl")
    assert "build_dataset" in str(err.value)
