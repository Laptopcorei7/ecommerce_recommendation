"""Load the trained model and verify its ordering invariants.

The previous loader silently accepted whatever was in the file. That let a model
with two conflicting item orderings serve wrong recommendations for months
without anything failing. Everything indexed by item is now checked to be the
same length as item_ids at load time, so a bad export fails loudly at startup
rather than quietly at inference.
"""

from __future__ import annotations

import json

import numpy as np
import scipy.sparse as sp

SUPPORTED_FORMAT_VERSION = 2


class ModelFormatError(RuntimeError):
    pass


def _csr(data, indices, indptr, shape):
    return sp.csr_matrix((data, indices, indptr), shape=tuple(int(x) for x in shape))


def load_model(path):
    try:
        d = np.load(path, allow_pickle=True)
    except FileNotFoundError:
        raise ModelFormatError(
            "model file not found: {}\nBuild it with:\n"
            "  python -m ml_api.pipeline.build_dataset\n"
            "  python -m ml_api.pipeline.train".format(path)
        ) from None

    version = int(d["format_version"]) if "format_version" in d.files else 1
    if version != SUPPORTED_FORMAT_VERSION:
        raise ModelFormatError(
            "model format v{} is not supported (need v{}). "
            "Retrain with: python -m ml_api.pipeline.train".format(
                version, SUPPORTED_FORMAT_VERSION)
        )

    item_ids = d["item_ids"]
    user_ids = d["user_ids"]
    n_items, n_users = len(item_ids), len(user_ids)

    model = {
        "format_version": version,
        "item_ids": item_ids,
        "user_ids": user_ids,
        "user_factors": d["user_factors"],
        "item_factors": d["item_factors"],
        "user_bias": d["user_bias"],
        "item_bias": d["item_bias"],
        "sigma": d["sigma"],
        "global_mean": float(d["global_mean"]),
        "alpha": float(d["alpha"]),
        "n_factors": int(d["n_factors"]),
        "content_sim": _csr(
            d["content_data"], d["content_indices"], d["content_indptr"], d["content_shape"]),
        "train_matrix": _csr(
            d["train_data"], d["train_indices"], d["train_indptr"], d["train_shape"]),
        # Derived, never stored. A stored copy is a second ordering that can
        # drift out of step with item_ids, which is exactly the bug this
        # rewrite exists to remove.
        "item_to_idx": {str(a): i for i, a in enumerate(item_ids)},
        "user_to_idx": {str(u): i for i, u in enumerate(user_ids)},
    }

    _check(model, n_users, n_items)
    return model


def _check(m, n_users, n_items):
    problems = []

    def want(name, got, expected):
        if got != expected:
            problems.append("{}: got {}, expected {}".format(name, got, expected))

    want("item_factors rows", m["item_factors"].shape[0], n_items)
    want("item_bias", m["item_bias"].shape[0], n_items)
    want("content_sim rows", m["content_sim"].shape[0], n_items)
    want("content_sim cols", m["content_sim"].shape[1], n_items)
    want("train_matrix cols", m["train_matrix"].shape[1], n_items)
    want("user_factors rows", m["user_factors"].shape[0], n_users)
    want("user_bias", m["user_bias"].shape[0], n_users)
    want("train_matrix rows", m["train_matrix"].shape[0], n_users)
    want("factor width", m["user_factors"].shape[1], m["item_factors"].shape[1])
    want("unique item ids", len(m["item_to_idx"]), n_items)
    want("unique user ids", len(m["user_to_idx"]), n_users)

    if not 0.0 <= m["alpha"] <= 1.0:
        problems.append("alpha {} outside [0, 1]".format(m["alpha"]))

    if problems:
        raise ModelFormatError(
            "model file failed its ordering invariants:\n  " + "\n  ".join(problems))


def load_catalog(path):
    """Product metadata keyed by item id, for turning ids into products."""
    catalog = {}
    try:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    rec = json.loads(line)
                    catalog[rec["id"]] = rec
    except FileNotFoundError:
        raise ModelFormatError(
            "catalog not found: {}\nBuild it with: "
            "python -m ml_api.pipeline.build_dataset".format(path)) from None
    return catalog
