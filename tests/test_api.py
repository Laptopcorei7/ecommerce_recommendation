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
    # The real threshold folds anything under 200 items into "Other", which at
    # 8 items would collapse the whole fixture into one bucket.
    monkeypatch.setenv("CATALOG_MIN_BUCKET", "1")
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


def test_sample_shoppers_are_described_by_their_real_history(client):
    """The storefront labels shoppers with these numbers instead of raw ids, so
    they have to agree with what /recommend/ reports for the same shopper."""
    body = client.get("/users/sample?n=3").json()
    assert [u["id"] for u in body["users"]] == body["user_ids"]
    for u in body["users"]:
        rec = client.get("/recommend/?user_id={}".format(u["id"])).json()
        assert u["rated"] == rec["rated"] > 0


def test_history_is_what_the_shopper_rated_and_never_what_is_recommended(client):
    body = client.get("/recommend/?user_id=USER00&top_n=100&history_n=50").json()
    history = {p["id"] for p in body["history"]}
    assert len(history) == body["rated"]
    assert all(p["user_rating"] is not None for p in body["history"])
    assert history.isdisjoint(p["id"] for p in body["items"])
    ratings = [p["user_rating"] for p in body["history"]]
    assert ratings == sorted(ratings, reverse=True)


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


# --- catalogue endpoints ----------------------------------------------------
#
# The storefront browses, searches and opens single products. None of that is a
# recommender question, and none of it existed before the redesign: the model
# service could answer "what next for this user" and nothing else, which is why
# every page of the old storefront carried a hardcoded array instead.

def test_categories_report_real_buckets_with_counts(client):
    cats = client.get("/catalog/categories").json()
    by_slug = {c["slug"]: c for c in cats}
    assert by_slug["home-audio"]["count"] == 4
    assert by_slug["cables"]["count"] == 4
    assert by_slug["home-audio"]["name"] == "Home Audio"


def test_every_product_is_reachable_from_exactly_one_category(client):
    """A product in no bucket is unreachable; one in two is double counted."""
    cats = client.get("/catalog/categories").json()
    assert sum(c["count"] for c in cats) == client.get("/health").json()["catalog"]


def test_products_are_paginated_with_a_true_total(client):
    body = client.get("/catalog/products?per_page=3").json()
    assert body["total"] == 8
    assert body["pages"] == 3
    assert len(body["items"]) == 3


def test_a_catalogue_listing_carries_no_score(client):
    """Score belongs to the recommendation path. A browse result that carried
    one would invite the storefront to rank by a number that means nothing."""
    item = client.get("/catalog/products?per_page=1").json()["items"][0]
    assert item["score"] is None
    assert item["collaborative"] is None


def test_products_can_be_filtered_by_category(client):
    body = client.get("/catalog/products?category=cables").json()
    assert body["total"] == 4
    assert all("Cable" in i["title"] for i in body["items"])


def test_an_unknown_category_is_a_404_not_an_unfiltered_listing(client):
    """Falling through to every product would be the quiet, wrong answer."""
    r = client.get("/catalog/products?category=ghost")
    assert r.status_code == 404
    assert "ghost" in r.json()["detail"]


def test_search_matches_title_and_brand(client):
    assert client.get("/catalog/products?q=wireless").json()["total"] == 4
    assert client.get("/catalog/products?q=beta").json()["total"] == 4


def test_an_unknown_sort_is_rejected_rather_than_silently_ignored(client):
    assert client.get("/catalog/products?sort=by-vibes").status_code == 422


def test_unpriced_products_sort_last_in_both_directions(client):
    """The fixture's ITEM03 has no price, as 45.2% of the real catalogue does."""
    for sort in ("price-asc", "price-desc"):
        ids = [i["id"] for i in
               client.get("/catalog/products?sort={}".format(sort)).json()["items"]]
        assert ids[-1] == "ITEM03", sort


def test_a_product_detail_returns_the_product_that_was_asked_for(client):
    """The storefront route used to ignore its own [id] segment entirely and
    render the same hardcoded product for every part number."""
    body = client.get("/catalog/products/ITEM04").json()
    assert body["product"]["id"] == "ITEM04"
    assert body["product"]["title"].startswith("Test Product 4")


def test_an_unknown_product_is_a_404_naming_the_id(client):
    r = client.get("/catalog/products/NOPE")
    assert r.status_code == 404
    assert "NOPE" in r.json()["detail"]


def test_similar_items_come_back_ranked_and_exclude_the_item_itself(client):
    body = client.get("/catalog/products/ITEM00?similar=3").json()
    ids = [s["id"] for s in body["similar"]]
    assert "ITEM00" not in ids
    scores = [s["score"] for s in body["similar"]]
    assert scores == sorted(scores, reverse=True)


def test_similar_can_be_switched_off(client):
    """The metadata route asks for zero neighbours; it must not pay for them."""
    assert client.get("/catalog/products/ITEM00?similar=0").json()["similar"] == []


def test_a_product_with_no_image_still_returns(client):
    """Three real records have no image. A null is data, not a failure."""
    assert client.get("/catalog/products/ITEM05").json()["product"]["image"] is None


# --- recommendation breakdown -----------------------------------------------

def test_each_recommendation_reports_the_two_halves_that_produced_it(client):
    """The storefront shows why an item ranked where it did rather than
    captioning it with invented copy such as "Perfect match for you"."""
    items = client.get("/recommend/?user_id=USER00&top_n=3").json()["items"]
    for item in items:
        assert item["collaborative"] is not None
        assert item["content"] is not None
        # The halves are the weighted terms, so they sum to the score.
        assert item["collaborative"] + item["content"] == pytest.approx(
            item["score"], abs=1e-3)


def test_the_response_states_the_alpha_it_actually_used(client):
    """Without this the storefront cannot label a result it did not choose the
    blend weight for."""
    assert client.get("/recommend/?user_id=USER00").json()["alpha"] == pytest.approx(0.9)
    assert client.get(
        "/recommend/?user_id=USER00&alpha=0.25").json()["alpha"] == pytest.approx(0.25)


def test_alpha_zero_leaves_only_the_content_half(client):
    """The recommendations page lets a reader drag alpha to 0 and see the
    collaborative contribution vanish. It has to actually vanish."""
    items = client.get("/recommend/?user_id=USER00&top_n=3&alpha=0.0").json()["items"]
    assert all(i["collaborative"] == 0.0 for i in items)


def test_every_product_carries_the_category_page_it_links_to(client):
    """The storefront links products to their category from this field. It used
    to derive the slug in the browser, which produced /categories/... URLs for
    raw category names that were folded away and therefore 404."""
    items = client.get("/catalog/products?per_page=8").json()["items"]
    slugs = {c["slug"] for c in client.get("/catalog/categories").json()}
    assert items
    for item in items:
        assert item["category_slug"] in slugs
        assert item["category_name"]


def test_recommended_products_carry_it_too(client):
    """The recommendation rows link to categories as well, so the field cannot
    be attached on the browse path only."""
    items = client.get("/recommend/?user_id=USER00&top_n=3").json()["items"]
    assert all(i["category_slug"] for i in items)
