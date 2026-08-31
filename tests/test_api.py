"""HTTP contract tests, run against the synthetic model.

The storefront is being rebuilt against this API, so the shape of the response
is now a contract rather than an implementation detail. The original returned
bare ASIN strings, which the frontend had no way to render, which is part of why
it never called the service at all.
"""

from __future__ import annotations

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(model_path, catalog_path, monkeypatch):
    """Point the app at the synthetic artefacts, then reload it so its
    module-level paths pick them up."""
    monkeypatch.setenv("MODEL_PATH", str(model_path))
    monkeypatch.setenv("CATALOG_PATH", str(catalog_path))
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
    import ml_api.main as main
    importlib.reload(main)
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def broken_client(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_PATH", str(tmp_path / "absent.npz"))
    monkeypatch.setenv("CATALOG_PATH", str(tmp_path / "absent.jsonl"))
    import ml_api.main as main
    importlib.reload(main)
    with TestClient(main.app) as c:
        yield c


# --- health -----------------------------------------------------------------

def test_health_reports_what_is_loaded(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["users"] == 6 and body["items"] == 8
    assert body["catalog"] == 8


def test_health_distinguishes_effective_alpha_from_training_alpha(client):
    """config.ALPHA is the source of truth at serve time. Reporting only the
    value baked into the model file would misdescribe what is running."""
    body = client.get("/health").json()
    assert "alpha" in body and "alpha_at_training" in body


def test_a_bad_model_file_yields_a_serviceable_error_not_a_dead_worker(broken_client):
    """The original loaded at import, so any problem killed the process with a
    traceback and no way to ask what was wrong."""
    body = broken_client.get("/health").json()
    assert body["status"] == "error"
    assert "build_dataset" in body["detail"]


def test_recommend_returns_503_when_the_model_failed_to_load(broken_client):
    assert broken_client.get("/recommend/?user_id=USER00").status_code == 503


# --- recommend --------------------------------------------------------------

def test_recommend_returns_products_not_bare_ids(client):
    body = client.get("/recommend/?user_id=USER00&top_n=3").json()
    assert body["user_id"] == "USER00"
    assert body["count"] == len(body["items"]) == 3
    first = body["items"][0]
    for field in ("id", "title", "price", "image", "store", "categories", "score"):
        assert field in first
    assert first["title"].startswith("Test Product")


def test_results_are_ordered_by_score(client):
    items = client.get("/recommend/?user_id=USER00&top_n=4").json()["items"]
    scores = [i["score"] for i in items]
    assert scores == sorted(scores, reverse=True)


def test_unknown_user_is_a_404_naming_the_user(client):
    r = client.get("/recommend/?user_id=ghost")
    assert r.status_code == 404
    assert "ghost" in r.json()["detail"]


def test_user_id_is_required(client):
    assert client.get("/recommend/").status_code == 422


@pytest.mark.parametrize("top_n", [0, -1, 101])
def test_top_n_is_bounded(client, top_n):
    assert client.get("/recommend/?user_id=USER00&top_n={}".format(top_n)).status_code == 422


@pytest.mark.parametrize("alpha", [-0.1, 1.1])
def test_alpha_override_is_bounded(client, alpha):
    assert client.get(
        "/recommend/?user_id=USER00&alpha={}".format(alpha)).status_code == 422


def test_alpha_override_changes_the_result(client):
    a = client.get("/recommend/?user_id=USER00&top_n=4&alpha=0.0").json()["items"]
    b = client.get("/recommend/?user_id=USER00&top_n=4&alpha=1.0").json()["items"]
    assert [i["id"] for i in a] != [i["id"] for i in b]


def test_no_already_rated_item_is_ever_returned(client):
    """The API-level guard for F-05, asked for more items than are eligible."""
    for user in ["USER00", "USER05"]:
        items = client.get("/recommend/?user_id={}&top_n=100".format(user)).json()["items"]
        assert len(items) > 0
        assert all(i["score"] > float("-inf") for i in items)


def test_an_item_missing_from_the_catalogue_still_returns(client, catalog_path):
    """A recommendation must not 500 because metadata is incomplete; the id is
    an acceptable fallback title."""
    catalog_path.write_text("", encoding="utf-8")
    import ml_api.main as main
    importlib.reload(main)
    with TestClient(main.app) as c:
        items = c.get("/recommend/?user_id=USER00&top_n=2").json()["items"]
        assert items[0]["title"] == items[0]["id"]


# --- sample users -----------------------------------------------------------

def test_users_sample_returns_ids_that_actually_work(client):
    """This endpoint exists so the docs and the storefront have something valid
    to call with. Ids it hands out must not 404."""
    ids = client.get("/users/sample?n=3").json()["user_ids"]
    assert len(ids) == 3
    for uid in ids:
        assert client.get("/recommend/?user_id={}".format(uid)).status_code == 200


# --- CORS -------------------------------------------------------------------

def test_the_storefront_origin_passes_preflight(client):
    """CORS was the deleted Django gateway's one real contribution."""
    r = client.options(
        "/recommend/",
        headers={"Origin": "http://localhost:3000",
                 "Access-Control-Request-Method": "GET"},
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_an_unlisted_origin_is_not_granted(client):
    r = client.options(
        "/recommend/",
        headers={"Origin": "http://evil.invalid",
                 "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") != "http://evil.invalid"
