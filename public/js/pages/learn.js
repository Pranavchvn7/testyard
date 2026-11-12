import { page } from "../registry.js";
import { h, $, $$, toast, stage, field, api, copy, esc, pretty, store } from "../ui.js";

const code = (title, text) => h("div", { style: { marginBottom: "14px" } },
  h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "6px" } }, h("b", { class: "mono", text: title }), h("button", { class: "btn sm", type: "button", "data-testid": "copy-snippet", onClick: () => copy(text) }, "Copy")), h("pre", { text }));

// ---------------------------------------------------------------- frameworks
const PW = {
  tree: `testyard-playwright/
├─ playwright.config.js        # baseURL, projects, retries, reporters
├─ package.json
├─ pages/                      # Page Object Model
│  ├─ AuthPage.js
│  └─ ShopPage.js
├─ fixtures/test.js            # custom fixtures (logged-in user, api client)
├─ tests/
│  ├─ ui/auth.spec.js
│  ├─ ui/shop.spec.js
│  └─ api/users.spec.js
├─ test-data/users.json
└─ .github/workflows/e2e.yml   # CI`,
  config: `// playwright.config.js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    extraHTTPHeaders: { "X-Sandbox": "my-ci-run" }, // isolated API data
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});`,
  pom: `// pages/AuthPage.js
export class AuthPage {
  constructor(page) { this.page = page; }
  async goto() { await this.page.goto("/practice/auth"); }
  async login(email, password) {
    await this.page.getByTestId("login-email").fill(email);
    await this.page.getByTestId("login-password").fill(password);
    await this.page.getByTestId("login-submit").click();
  }
  get profileName() { return this.page.getByTestId("profile-name"); }
  get error() { return this.page.getByTestId("msg-error"); }
}`,
  spec: `// tests/ui/auth.spec.js
import { test, expect } from "@playwright/test";
import { AuthPage } from "../../pages/AuthPage.js";

test.describe("Login", () => {
  test("valid credentials show the profile", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login("practice@testyard.dev", "SecretPass1!");
    await expect(auth.profileName).toHaveText("Practice User");
  });

  test("wrong password shows an error", async ({ page }) => {
    const auth = new AuthPage(page);
    await auth.goto();
    await auth.login("practice@testyard.dev", "nope");
    await expect(auth.error).toContainText("Incorrect email address or password");
  });
});`,
  api: `// tests/api/users.spec.js
import { test, expect } from "@playwright/test";

test("user CRUD lifecycle", async ({ request }) => {
  const created = await request.post("/api/users", { data: { name: "Nina", job: "SDET" } });
  expect(created.status()).toBe(201);
  const { data } = await created.json();

  const patched = await request.patch("/api/users/" + data.id, { data: { job: "Lead" } });
  expect((await patched.json()).data.job).toBe("Lead");

  expect((await request.delete("/api/users/" + data.id)).status()).toBe(204);
  expect((await request.get("/api/users/" + data.id)).status()).toBe(404);
});`,
  ci: `# .github/workflows/e2e.yml
name: e2e
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --project=chromium
        env: { BASE_URL: "https://YOUR-TESTYARD-URL" }
      - uses: actions/upload-artifact@v4
        if: always()
        with: { name: playwright-report, path: playwright-report }`,
};
const SEL = {
  tree: `testyard-selenium/
├─ requirements.txt            # selenium, pytest, pytest-html, requests
├─ pytest.ini
├─ conftest.py                 # driver fixture, base_url option
├─ pages/
│  ├─ base_page.py             # explicit waits, helpers
│  └─ auth_page.py
├─ tests/
│  ├─ test_auth.py
│  └─ test_dynamic_loading.py
└─ utils/api_client.py`,
  base: `# pages/base_page.py
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

class BasePage:
    def __init__(self, driver, base_url):
        self.driver, self.base_url = driver, base_url
        self.wait = WebDriverWait(driver, 10)

    def tid(self, test_id):
        return (By.CSS_SELECTOR, f'[data-testid="{test_id}"]')

    def click(self, test_id):
        self.wait.until(EC.element_to_be_clickable(self.tid(test_id))).click()

    def type(self, test_id, text):
        el = self.wait.until(EC.visibility_of_element_located(self.tid(test_id)))
        el.clear(); el.send_keys(text)

    def text(self, test_id):
        return self.wait.until(EC.visibility_of_element_located(self.tid(test_id))).text`,
  test: `# tests/test_auth.py
from pages.base_page import BasePage

def test_login_success(driver, base_url):
    page = BasePage(driver, base_url)
    driver.get(base_url + "/practice/auth")
    page.type("login-email", "practice@testyard.dev")
    page.type("login-password", "SecretPass1!")
    page.click("login-submit")
    assert page.text("profile-name") == "Practice User"

def test_dynamic_loading(driver, base_url):
    page = BasePage(driver, base_url)
    driver.get(base_url + "/practice/dynamic-loading")
    page.click("start-hidden")
    assert page.text("finish-hidden") == "Hello World!"   # waits up to 10 s`,
  conftest: `# conftest.py
import pytest
from selenium import webdriver

def pytest_addoption(parser):
    parser.addoption("--base-url", default="http://localhost:3000")

@pytest.fixture
def base_url(request):
    return request.config.getoption("--base-url")

@pytest.fixture
def driver():
    opts = webdriver.ChromeOptions()
    opts.add_argument("--headless=new")
    d = webdriver.Chrome(options=opts)   # Selenium Manager finds the driver
    d.set_window_size(1366, 900)
    yield d
    d.quit()`,
};
const CY = {
  tree: `testyard-cypress/
├─ cypress.config.js
├─ cypress/
│  ├─ e2e/auth.cy.js
│  ├─ e2e/shop.cy.js
│  ├─ support/commands.js      # cy.loginApi(), cy.tid()
│  └─ fixtures/user.json
└─ package.json`,
  cmds: `// cypress/support/commands.js
Cypress.Commands.add("tid", (id) => cy.get('[data-testid="' + id + '"]'));

Cypress.Commands.add("loginApi", () => {
  cy.request({ method: "POST", url: "/api/auth/login", headers: { "X-Sandbox": "cy-run" },
    body: { email: "practice@testyard.dev", password: "SecretPass1!" } })
    .then(({ body }) => {
      window.localStorage.setItem("ty.token", JSON.stringify(body.data.token));
      window.localStorage.setItem("ty.user", JSON.stringify({ id: body.data.id, name: body.data.name, email: body.data.email }));
    });
});`,
  spec: `// cypress/e2e/shop.cy.js
describe("Shop", () => {
  beforeEach(() => cy.visit("/practice/shop"));

  it("shows free shipping from $75", () => {
    cy.intercept("GET", "/api/products*").as("products");
    cy.wait("@products");
    cy.tid("add-to-cart").first().click();          // $89.99 keyboard
    cy.tid("shipping").should("have.text", "FREE");
  });

  it("filters by category", () => {
    cy.tid("shop-category").select("Books");
    cy.tid("product-card").should("have.length.greaterThan", 0);
    cy.tid("product-name").first().should("not.be.empty");
  });
});`,
};
const REST = {
  tree: `testyard-api-tests/                # any stack: RestAssured, requests, supertest...
├─ src/test/java/.../AuthTests.java
├─ src/test/resources/schemas/user.json   # JSON-schema contract
└─ pom.xml`,
  ra: `// RestAssured (Java 17, JUnit 5)
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

class UserApiTest {
  @BeforeAll static void setup() {
    baseURI = System.getProperty("baseUrl", "http://localhost:3000");
    requestSpecification = given().header("X-Sandbox", "java-" + System.nanoTime());
  }

  @Test void createAndFetchUser() {
    int id = given().contentType("application/json")
        .body("{\\"name\\":\\"Nina\\",\\"job\\":\\"SDET\\"}")
      .when().post("/api/users")
      .then().statusCode(201).body("data.name", equalTo("Nina")).extract().path("data.id");

    when().get("/api/users/{id}", id).then().statusCode(200).body("data.job", equalTo("SDET"));
  }
}`,
  py: `# requests + pytest
import requests, uuid
BASE = "http://localhost:3000"
H = {"X-Sandbox": "py-" + uuid.uuid4().hex[:8]}

def test_login_and_profile():
    r = requests.post(BASE + "/api/auth/login", headers=H,
                      json={"email": "practice@testyard.dev", "password": "SecretPass1!"})
    assert r.status_code == 200
    token = r.json()["data"]["token"]
    p = requests.get(BASE + "/api/auth/profile", headers={**H, "Authorization": "Bearer " + token})
    assert p.json()["data"]["email"] == "practice@testyard.dev"`,
};
const ROADMAP = [
  ["Pick the stack & write a charter", "Language, runner, assertion library, reporting. Decide what belongs in UI vs API tests (test pyramid)."],
  ["Project skeleton & config", "Folders, linting, env-based config (BASE_URL), no secrets in code."],
  ["Locator strategy", "Prefer role/label/test-id over XPath. Agree on data-testid conventions with developers."],
  ["Page Object Model (or components)", "One class per page/component. Methods express intent (login), not clicks. No assertions hidden in page objects."],
  ["Waits & synchronisation", "Use auto-waiting and condition-based waits. Never fixed sleeps. Practise on the Dynamic pages."],
  ["Test data management", "Factories/builders, unique data per run, API-based setup and teardown (use X-Sandbox for isolation)."],
  ["API layer", "A typed client + schema checks. Use it to set up state quickly and to test the contract directly."],
  ["Fixtures & hooks", "Logged-in session reuse, browser contexts, cleanup. Keep tests independent and parallel-safe."],
  ["Reporting & diagnostics", "HTML/Allure reports, screenshots, traces/videos on failure, log capture."],
  ["CI/CD", "Run on every PR, parallelise, retry sparingly, publish reports, fail the build on red."],
  ["Maintainability", "Naming, code review, flaky-test quarantine policy, documentation and metrics (pass rate, duration, flake rate)."],
];
page({
  id: "frameworks", group: "learn", title: "Build an automation framework",
  blurb: "An 11-step roadmap plus copy-paste starters for Playwright, Selenium, Cypress and API testing — all written against this site’s test ids.",
  tasks: ["Follow the roadmap and create your own repo with the Playwright starter.", "Automate the login flow and the Dynamic loading page with Page Objects.", "Add API setup (register + login) and reuse the session across tests.", "Add a CI workflow that runs against your deployed TestYard URL.", "Add a report and a failure screenshot/trace."],
  render(root) {
    const sets = {
      Playwright: [["Folder structure", PW.tree], ["playwright.config.js", PW.config], ["Page object", PW.pom], ["UI test", PW.spec], ["API test", PW.api], ["CI (GitHub Actions)", PW.ci]],
      Selenium: [["Folder structure", SEL.tree], ["conftest.py", SEL.conftest], ["Base page with explicit waits", SEL.base], ["Tests", SEL.test]],
      Cypress: [["Folder structure", CY.tree], ["Custom commands", CY.cmds], ["Specs", CY.spec]],
      "API testing": [["Folder structure", REST.tree], ["RestAssured", REST.ra], ["Python requests", REST.py]],
    };
    const names = Object.keys(sets);
    const panels = names.map((n, i) => h("div", { role: "tabpanel", hidden: i !== 0, "data-testid": "fw-panel-" + n.toLowerCase().replace(/\W+/g, "-") }, sets[n].map(([t, c]) => code(t, c))));
    const tabBtns = names.map((n, i) => h("button", { role: "tab", "aria-selected": String(i === 0), "data-testid": "fw-tab-" + n.toLowerCase().replace(/\W+/g, "-") }, n));
    const tabs = h("div", { class: "tabs" }, h("div", { role: "tablist" }, tabBtns), panels);
    tabBtns.forEach((b, i) => b.addEventListener("click", () => { tabBtns.forEach((x, j) => x.setAttribute("aria-selected", String(i === j))); panels.forEach((p, j) => (p.hidden = i !== j)); }));
    root.append(
      stage(h("h2", { text: "Roadmap" }), h("ol", { "data-testid": "roadmap", style: { paddingLeft: "20px" } }, ROADMAP.map(([t, d]) => h("li", { style: { marginBottom: "8px" } }, h("b", { text: t + ". " }), h("span", { class: "muted", text: d }))))),
      stage(h("h2", { text: "Starter code" }), tabs, h("p", { class: "hint", html: "A runnable Playwright starter also lives in the repository under <code>frameworks/playwright</code>." })));
  },
});

// ---------------------------------------------------------------- cheatsheet
page({
  id: "cheatsheet", group: "learn", title: "Locators, waits & assertions cheatsheet",
  blurb: "The same ideas in Playwright, Selenium (Python) and Cypress side by side.",
  tasks: ["Rewrite one of your Selenium tests in Playwright using this table.", "Find a place where you used sleep() and replace it with the right wait."],
  render(root) {
    const rows = {
      "Locators": [
        ["By test id", 'page.getByTestId("login-submit")', 'driver.find_element(By.CSS_SELECTOR, \'[data-testid="login-submit"]\')', 'cy.get(\'[data-testid="login-submit"]\')'],
        ["By role + name", 'page.getByRole("button", { name: "Log in" })', "(no built-in role locator; use CSS/XPath or aria attributes)", "cy.contains(\"button\", \"Log in\")"],
        ["By label", 'page.getByLabel("Email")', 'find_element(By.CSS_SELECTOR, "#email")', 'cy.get("#email")'],
        ["By text", 'page.getByText("Hello World!")', 'find_element(By.XPATH, "//*[text()=\'Hello World!\']")', 'cy.contains("Hello World!")'],
        ["XPath", 'page.locator("xpath=//tr[td[text()=\'QA\']]")', 'find_element(By.XPATH, "//tr[td[text()=\'QA\']]")', "cy.xpath() needs a plugin"],
        ["Shadow DOM", "pierces open roots by default", "element.shadow_root.find_element(...)", "cy.get(sel).shadow().find(...) or includeShadowDom: true"],
        ["iFrame", 'page.frameLocator("iframe[name=outer-frame]").locator("#x")', "driver.switch_to.frame(el)", "cy.iframe() plugin or cy.get(...).its('0.contentDocument.body')"],
      ],
      "Waiting": [
        ["Auto-wait", "built in for actions and web-first assertions", "not built in: use WebDriverWait", "retries commands and assertions for up to 4 s by default"],
        ["Element visible", 'await expect(loc).toBeVisible()', "wait.until(EC.visibility_of_element_located(by))", "cy.get(sel).should('be.visible')"],
        ["Network idle / response", 'await page.waitForResponse("**/api/users*")', "(use a proxy or poll the DOM)", 'cy.intercept("GET", "/api/users*").as("u"); cy.wait("@u")'],
        ["Never do this", "page.waitForTimeout(5000)", "time.sleep(5)", "cy.wait(5000)"],
      ],
      "Assertions": [
        ["Text equals", 'await expect(loc).toHaveText("Saved")', "assert el.text == 'Saved'", "cy.get(sel).should('have.text', 'Saved')"],
        ["Count", "await expect(loc).toHaveCount(3)", "assert len(els) == 3", "cy.get(sel).should('have.length', 3)"],
        ["Attribute", 'await expect(loc).toHaveAttribute("aria-selected", "true")', 'assert el.get_attribute("aria-selected") == "true"', "cy.get(sel).should('have.attr', 'aria-selected', 'true')"],
        ["URL", 'await expect(page).toHaveURL(/\\/practice\\/shop/)', "assert '/practice/shop' in driver.current_url", "cy.url().should('include', '/practice/shop')"],
      ],
      "Actions": [
        ["Hover", "await loc.hover()", "ActionChains(driver).move_to_element(el).perform()", "cy.get(sel).trigger('mouseover')"],
        ["Drag & drop", "await src.dragTo(target)", "ActionChains(driver).drag_and_drop(src, tgt).perform()", "needs a plugin or manual dataTransfer events"],
        ["Upload", 'await loc.setInputFiles("a.png")', 'el.send_keys("/abs/a.png")', "cy.get(sel).selectFile('a.png')"],
        ["Dialogs", 'page.on("dialog", d => d.accept())', "driver.switch_to.alert.accept()", "cy.on('window:confirm', () => true)"],
      ],
    };
    const cell = (c, i) => h("td", { style: { whiteSpace: "normal", minWidth: i ? "220px" : "110px", fontFamily: i ? "var(--mono)" : "", fontSize: i ? ".78rem" : "" }, text: c });
    const section = ([t, rs]) => {
      const head = h("thead", {}, h("tr", {}, ["Task", "Playwright (JS)", "Selenium (Python)", "Cypress"].map((c) => h("th", { text: c }))));
      const body = h("tbody", {}, rs.map((r) => h("tr", {}, r.map(cell))));
      const table = h("table", { "data-testid": "cheat-" + t.toLowerCase() }, head, body);
      return stage(h("h2", { text: t }), h("div", { class: "tbl-wrap" }, table));
    };
    root.append(...Object.entries(rows).map(section));
  },
});

// ---------------------------------------------------------------- selector tester
/** Parse untrusted HTML in an inert document and drop anything that can run code or load resources. */
function cleanHtml(markup) {
  const doc = new DOMParser().parseFromString(markup, "text/html"); // scripts never run and nothing loads in this document
  doc.querySelectorAll("script,style,iframe,frame,object,embed,link,meta,base,svg,math,template,noscript").forEach((el) => el.remove());
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase(), val = attr.value.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || name === "style" || ((name === "href" || name === "src" || name === "action" || name === "formaction" || name === "xlink:href") && /^(javascript|data|vbscript):/.test(val))) el.removeAttribute(attr.name);
    }
    if (el.hasAttribute("src")) el.removeAttribute("src"); // no remote loads from a pasted sample
  }
  return [...doc.body.childNodes];
}
const SAMPLE = `<div id="sample" class="shop">
  <h1 class="title">Fresh Fruit</h1>
  <ul class="items">
    <li class="item" data-price="3">Apple <span class="tag">new</span></li>
    <li class="item sale" data-price="2">Banana</li>
    <li class="item" data-price="5">Cherry <span class="tag">hot</span></li>
  </ul>
  <form id="f"><label for="q">Search</label><input id="q" name="query" placeholder="Find…">
  <button type="submit" class="btn primary">Go</button> <button type="reset" class="btn">Clear</button></form>
</div>`;
page({
  id: "selector-tester", group: "tools", title: "XPath & CSS selector tester",
  blurb: "Edit the sample HTML, type a selector and see live matches highlighted — the fastest way to learn selector syntax.",
  tasks: ["Select only the sale item with CSS, then with XPath.", "Select the button next to the Search input using a sibling axis.", "Select items with data-price greater than 2 using XPath.", "Select the text node “Banana” with XPath text()."],
  render(root) {
    const html = h("textarea", { rows: "12", class: "mono", "data-testid": "st-html", spellcheck: "false", "aria-label": "Sample HTML" }); html.value = SAMPLE;
    const mode = h("select", { style: { width: "110px" }, "data-testid": "st-mode", "aria-label": "Selector type" }, h("option", { value: "css", text: "CSS" }), h("option", { value: "xpath", text: "XPath" }));
    const sel = h("input", { type: "text", value: "li.item.sale", "data-testid": "st-selector", spellcheck: "false", "aria-label": "Selector" });
    const view = h("div", { class: "scroll-box", "data-testid": "st-preview", style: { height: "auto", maxHeight: "300px" } });
    const out = h("div", { "data-testid": "st-result", role: "status" }), list = h("pre", { "data-testid": "st-matches" });
    const run = () => {
      view.replaceChildren(...cleanHtml(html.value));
      $$(".st-hit", view).forEach((e) => e.classList.remove("st-hit"));
      let nodes = [];
      try {
        if (mode.value === "css") nodes = [...view.querySelectorAll(sel.value)];
        else { const snap = document.evaluate(sel.value, view, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null); for (let i = 0; i < snap.snapshotLength; i++) nodes.push(snap.snapshotItem(i)); }
        out.replaceChildren(h("div", { class: "alert " + (nodes.length ? "ok" : "warn") }, h("b", { "data-testid": "st-count", text: String(nodes.length) }), nodes.length === 1 ? " match" : " matches"));
      } catch (e) { out.replaceChildren(h("div", { class: "alert bad", "data-testid": "st-error", text: "Invalid selector: " + e.message })); }
      nodes.forEach((n) => n.nodeType === 1 && n.classList.add("st-hit"));
      list.textContent = nodes.slice(0, 8).map((n) => (n.nodeType === 1 ? n.outerHTML : "#text: " + n.textContent)).join("\n---\n") || "(no matches)";
    };
    [html, mode, sel].forEach((x) => x.addEventListener("input", run));
    const st = document.createElement("style"); st.textContent = ".st-hit{outline:3px solid var(--accent);outline-offset:2px;background:var(--accent-soft)}"; root.append(st);
    root.append(h("div", { class: "grid g2", style: { alignItems: "start" } }, stage(field("Sample HTML", html)), stage(h("div", { class: "row", style: { flexWrap: "nowrap" } }, mode, sel), h("div", { style: { margin: "12px 0" } }, out), view, h("div", { class: "label", style: { margin: "12px 0 4px" }, text: "Matched nodes" }), list)));
    run();
  },
});

// ---------------------------------------------------------------- diagnostics
page({
  id: "diagnostics", group: "tools", title: "HTTP & browser diagnostics",
  blurb: "Status code explorer, request headers, your IP and browser information — all served by the real API.",
  tasks: ["Pick every status class (2xx–5xx) and assert the response.", "Send a custom header from the console and find it on the headers page.", "Compare navigator.userAgent with the headless value.", "Assert the IP endpoint returns an IPv4/IPv6-looking value."],
  render(root) {
    const sOut = h("pre", { "data-testid": "diag-status-out" }, "Pick a code and press Send");
    const code = h("select", { style: { width: "auto" }, "data-testid": "diag-code" }, [200, 201, 204, 301, 400, 401, 403, 404, 405, 409, 418, 422, 429, 500, 502, 503].map((c) => h("option", { value: c, text: c })));
    const hdrOut = h("pre", { "data-testid": "diag-headers-out" }, "—"), ipOut = h("p", { class: "mono", "data-testid": "diag-ip" , text: "—" });
    const info = { userAgent: navigator.userAgent, platform: navigator.platform, language: navigator.language, languages: navigator.languages, viewport: `${innerWidth}×${innerHeight}`, devicePixelRatio: devicePixelRatio, cookiesEnabled: navigator.cookieEnabled, online: navigator.onLine, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, webdriver: navigator.webdriver, touch: "ontouchstart" in window };
    root.append(h("div", { class: "grid g2", style: { alignItems: "start" } },
      stage(h("h2", { text: "Status codes" }), h("div", { class: "row" }, code, h("button", { class: "btn primary", type: "button", "data-testid": "diag-send", onClick: async () => { const r = await api("GET", "/api/status/" + code.value, undefined, { auth: false, redirect: "manual" }); sOut.textContent = `HTTP ${r.status}\n` + (r.text || "(empty body)"); } }, "Send")), h("div", { class: "result" }, sOut)),
      stage(h("h2", { text: "Request headers" }), h("button", { class: "btn", type: "button", "data-testid": "diag-headers", onClick: async () => { const r = await api("GET", "/api/headers", undefined, { auth: false, headers: { "X-Practice": "hello" } }); hdrOut.textContent = pretty(r.data); } }, "Show headers the server sees"), h("div", { class: "result" }, hdrOut)),
      stage(h("h2", { text: "My IP address" }), h("button", { class: "btn", type: "button", "data-testid": "diag-ip-btn", onClick: async () => { const r = await api("GET", "/api/ip", undefined, { auth: false }); ipOut.textContent = r.ok ? r.data.data.ip : "error"; } }, "Look up"), h("div", { class: "result" }, ipOut)),
      stage(h("h2", { text: "My browser" }), h("pre", { "data-testid": "diag-browser", text: pretty(info) }))));
  },
});

// ---------------------------------------------------------------- browser state
page({
  id: "browser-state", group: "tools", title: "Cookies, storage, console & errors",
  blurb: "Read and write cookies and localStorage, request geolocation, emit console messages and throw real JavaScript errors.",
  tasks: ["Set a cookie and assert it with context.cookies() / driver.get_cookies().", "Write to localStorage and read it back via evaluate / execute_script.", "Listen to console events and capture the warn and error messages.", "Listen for pageerror and assert the uncaught error text.", "Grant or deny geolocation permission and assert the outcome."],
  render(root) {
    const ck = h("pre", { "data-testid": "cookie-out" }, "—"), ls = h("pre", { "data-testid": "ls-out" }, "—"), geo = h("pre", { "data-testid": "geo-out" }, "—");
    const k = h("input", { value: "tester", "data-testid": "kv-key", "aria-label": "Key" }), v = h("input", { value: "TestYard", "data-testid": "kv-value", "aria-label": "Value" });
    const showCk = () => (ck.textContent = document.cookie || "(no cookies)");
    const showLs = () => { try { ls.textContent = pretty(Object.fromEntries(Object.keys(localStorage).filter((x) => !x.startsWith("ty.")).map((x) => [x, localStorage.getItem(x)]))) || "{}"; } catch { ls.textContent = "localStorage unavailable"; } };
    const btn = (label, id, fn) => h("button", { class: "btn", type: "button", "data-testid": id, onClick: fn }, label);
    root.append(h("div", { class: "grid g2", style: { alignItems: "start" } },
      stage(h("h2", { text: "Cookies & localStorage" }), h("div", { class: "grid g2" }, field("Key", k), field("Value", v)), h("div", { class: "row" },
        btn("Set cookie", "set-cookie", () => { document.cookie = `${encodeURIComponent(k.value)}=${encodeURIComponent(v.value)}; path=/; max-age=3600; SameSite=Lax`; showCk(); }),
        btn("Delete cookie", "del-cookie", () => { document.cookie = `${encodeURIComponent(k.value)}=; path=/; max-age=0`; showCk(); }),
        btn("Set localStorage", "set-ls", () => { try { localStorage.setItem(k.value, v.value); } catch { toast("Storage blocked", "bad"); } showLs(); }),
        btn("Clear mine", "clear-ls", () => { try { localStorage.removeItem(k.value); } catch { /* ignore */ } showLs(); })), h("div", { class: "result" }, h("div", { class: "label", text: "document.cookie" }), ck, h("div", { class: "label", style: { marginTop: "10px" }, text: "localStorage (non-TestYard keys)" }), ls)),
      stage(h("h2", { text: "Console & errors" }), h("div", { class: "row" },
        btn("console.log", "log", () => console.log("TestYard log message", { time: Date.now() })), btn("console.warn", "warn", () => console.warn("TestYard warning message")), btn("console.error", "error", () => console.error("TestYard error message")), btn("console.table", "table", () => console.table([{ id: 1, name: "a" }, { id: 2, name: "b" }])),
        btn("Throw uncaught error", "throw", () => setTimeout(() => { throw new Error("Uncaught TestYard error"); }, 0)), btn("Unhandled rejection", "reject", () => Promise.reject(new Error("Unhandled TestYard rejection")))), h("p", { class: "hint", text: "Open DevTools or attach console / pageerror listeners in your framework." })),
      stage(h("h2", { text: "Geolocation" }), btn("Get my location", "geo", () => { if (!navigator.geolocation) { geo.textContent = "Geolocation not supported"; return; } geo.textContent = "Requesting…"; navigator.geolocation.getCurrentPosition((p) => (geo.textContent = pretty({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), accuracy: Math.round(p.coords.accuracy) })), (e) => (geo.textContent = `Error ${e.code}: ${e.message}`), { timeout: 8000 }); }), h("div", { class: "result" }, geo))));
    showCk(); showLs();
  },
});
