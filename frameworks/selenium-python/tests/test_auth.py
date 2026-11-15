import pytest

from pages.auth_page import AuthPage


@pytest.mark.smoke
def test_login_success(driver, base_url):
    page = AuthPage(driver, base_url).goto().login("practice@testyard.dev", "SecretPass1!")
    assert page.profile_name == "Practice User"


@pytest.mark.regression
def test_login_wrong_password(driver, base_url):
    page = AuthPage(driver, base_url).goto().login("practice@testyard.dev", "wrong-password")
    assert "Incorrect email address or password" in page.error
