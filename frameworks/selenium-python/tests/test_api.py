import uuid

import pytest
import requests


@pytest.fixture
def api(base_url):
    s = requests.Session()
    s.headers["X-Sandbox"] = "py-" + uuid.uuid4().hex[:8]  # isolated data per test
    s.base = base_url + "/api"
    return s


@pytest.mark.smoke
def test_user_crud_lifecycle(api):
    created = api.post(api.base + "/users", json={"name": "Nina", "job": "SDET"})
    assert created.status_code == 201
    uid = created.json()["data"]["id"]
    assert api.patch(f"{api.base}/users/{uid}", json={"job": "Lead"}).json()["data"]["job"] == "Lead"
    assert api.delete(f"{api.base}/users/{uid}").status_code == 204
    assert api.get(f"{api.base}/users/{uid}").status_code == 404
