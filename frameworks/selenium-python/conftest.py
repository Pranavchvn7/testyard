"""pytest fixtures: browser choice, remote grid support, screenshot on failure."""
import os
from pathlib import Path

import pytest
from selenium import webdriver


def pytest_addoption(parser):
    parser.addoption("--base-url", default=os.getenv("BASE_URL", "http://localhost:3000"))
    parser.addoption("--browser", default=os.getenv("BROWSER", "chrome"), choices=["chrome", "firefox", "edge"])
    parser.addoption("--headed", action="store_true", help="show the browser window")


@pytest.fixture(scope="session")
def base_url(request):
    return request.config.getoption("--base-url").rstrip("/")


def _options(name, headed):
    if name == "firefox":
        opts = webdriver.FirefoxOptions()
        if not headed:
            opts.add_argument("-headless")
        return opts
    opts = webdriver.EdgeOptions() if name == "edge" else webdriver.ChromeOptions()
    if not headed:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1366,900")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    return opts


@pytest.fixture
def driver(request):
    name = request.config.getoption("--browser")
    opts = _options(name, request.config.getoption("--headed"))
    remote = os.getenv("SELENIUM_REMOTE_URL")  # e.g. http://localhost:4444/wd/hub
    if remote:
        drv = webdriver.Remote(command_executor=remote, options=opts)
    else:
        drv = {"chrome": webdriver.Chrome, "firefox": webdriver.Firefox, "edge": webdriver.Edge}[name](options=opts)
    drv.implicitly_wait(0)  # never mix implicit and explicit waits
    yield drv
    drv.quit()


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when == "call" and report.failed and "driver" in item.funcargs:
        out = Path("results/screenshots")
        out.mkdir(parents=True, exist_ok=True)
        item.funcargs["driver"].save_screenshot(str(out / f"{item.name}.png"))
