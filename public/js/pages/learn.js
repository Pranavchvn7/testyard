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
const PWTS = {
  tree: `testyard-e2e/
├─ playwright.config.ts          # projects, dependencies, reporters, webServer
├─ package.json  tsconfig.json  .env.example  .eslintrc.cjs  .prettierrc
├─ global-setup.ts               # optional: seed data / health check
├─ fixtures/
│  ├─ index.ts                   # test = base.extend({ ... }), re-export expect
│  ├─ auth.setup.ts              # logs in once, saves storageState
│  └─ api-client.ts              # typed API helper using APIRequestContext
├─ pages/                        # page objects (one per page)
│  ├─ auth.page.ts  shop.page.ts
│  └─ components/                # reusable component objects
│     ├─ toast.component.ts  data-grid.component.ts
├─ tests/
│  ├─ smoke/        *.spec.ts    # tag @smoke, runs on every PR
│  ├─ regression/   *.spec.ts
│  ├─ api/          *.spec.ts
│  ├─ a11y/  visual/
├─ test-data/                    # factories + static JSON
│  └─ factories.ts
├─ utils/                        # env.ts, logger.ts, wait helpers
├─ .auth/                        # storageState files (git-ignored)
└─ .github/workflows/e2e.yml`,
  config: `// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,          // fail CI if test.only is committed
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [["github"], ["blob"], ["junit", { outputFile: "results/junit.xml" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    testIdAttribute: "data-testid",      // matches TestYard
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    extraHTTPHeaders: { "X-Sandbox": process.env.SANDBOX_ID ?? "local-run" },
  },
  projects: [
    { name: "setup", testMatch: /.*\\.setup\\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: ".auth/user.json" },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], storageState: ".auth/user.json" },
      dependencies: ["setup"],
    },
    { name: "mobile", use: { ...devices["Pixel 7"], storageState: ".auth/user.json" }, dependencies: ["setup"] },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm start", cwd: "../testyard", url: "http://localhost:3000/api/health", reuseExistingServer: true },
});`,
  auth: `// fixtures/auth.setup.ts: log in ONCE through the API, reuse everywhere
import { test as setup, expect } from "@playwright/test";

setup("authenticate", async ({ request, page }) => {
  const res = await request.post("/api/auth/login", {
    data: { email: process.env.TEST_EMAIL ?? "practice@testyard.dev", password: process.env.TEST_PASSWORD ?? "SecretPass1!" },
  });
  expect(res.ok()).toBeTruthy();
  const { data } = await res.json();
  await page.goto("/");
  await page.evaluate((d) => {
    localStorage.setItem("ty.token", JSON.stringify(d.token));
    localStorage.setItem("ty.user", JSON.stringify({ id: d.id, name: d.name, email: d.email }));
  }, data);
  await page.context().storageState({ path: ".auth/user.json" });
});`,
  fixtures: `// fixtures/index.ts: dependency-injected page objects and API client
import { test as base, expect } from "@playwright/test";
import { AuthPage } from "../pages/auth.page";
import { ShopPage } from "../pages/shop.page";
import { ApiClient } from "./api-client";

type Fixtures = { authPage: AuthPage; shopPage: ShopPage; api: ApiClient; freshUser: { email: string; password: string } };

export const test = base.extend<Fixtures>({
  authPage: async ({ page }, use) => { await use(new AuthPage(page)); },
  shopPage: async ({ page }, use) => { await use(new ShopPage(page)); },
  api: async ({ request }, use) => { await use(new ApiClient(request)); },
  // per-test unique user created through the API, deleted afterwards
  freshUser: async ({ api }, use) => {
    const user = { email: \`qa+\${Date.now()}@example.test\`, password: "Passw0rd!" };
    await api.register("Fixture User", user.email, user.password);
    await use(user);
    await api.deleteAccount(user.email, user.password);
  },
});
export { expect };`,
  page: `// pages/shop.page.ts: intent-revealing methods, locators as getters, no assertions inside
import type { Locator, Page } from "@playwright/test";

export class ShopPage {
  readonly cards: Locator;
  readonly cartCount: Locator;
  constructor(private readonly page: Page) {
    this.cards = page.getByTestId("product-card");
    this.cartCount = page.getByTestId("cart-count");
  }
  async goto() { await this.page.goto("/practice/shop"); }
  card(name: string) { return this.cards.filter({ hasText: name }); }
  async addToCart(name: string) { await this.card(name).getByRole("button", { name: /add to cart/i }).click(); }
  async filterBy(category: string) { await this.page.getByTestId("shop-category").selectOption(category); }
}`,
  spec: `// tests/smoke/shop.spec.ts
import { test, expect } from "../../fixtures";

test.describe("Shop @smoke", () => {
  test.beforeEach(async ({ shopPage }) => { await shopPage.goto(); });

  test("adds a product to the cart", async ({ shopPage }) => {
    await shopPage.addToCart("Clean Code");
    await expect(shopPage.cartCount).toHaveText("1");
  });

  test("filters by category", async ({ shopPage }) => {
    await shopPage.filterBy("Books");
    await expect(shopPage.cards.first()).toContainText(/Clean Code|Pragmatic|Testing/);
  });

  for (const category of ["Electronics", "Books", "Home", "Clothing"]) {
    test(\`category \${category} shows products\`, async ({ shopPage }) => {
      await shopPage.filterBy(category);
      await expect(shopPage.cards).not.toHaveCount(0);
    });
  }
});`,
  factory: `// test-data/factories.ts
let n = 0;
export const buildUser = (over: Partial<{ name: string; job: string; email: string }> = {}) => ({
  name: "QA User " + ++n,
  job: "SDET",
  email: \`qa.\${Date.now()}.\${n}@example.test\`,
  ...over,
});
export const buildOrder = (productId = 1, qty = 1) => ({
  items: [{ productId, qty }],
  customer: { name: "Jane Tester", email: "jane@example.test", address: "1 Test Street" },
});`,
  api: `// fixtures/api-client.ts
import type { APIRequestContext } from "@playwright/test";

export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}
  async register(name: string, email: string, password: string) {
    const r = await this.request.post("/api/auth/register", { data: { name, email, password } });
    if (r.status() !== 201) throw new Error("register failed: " + r.status());
    return (await r.json()).data;
  }
  async login(email: string, password: string) {
    const r = await this.request.post("/api/auth/login", { data: { email, password } });
    return (await r.json()).data as { token: string };
  }
  async deleteAccount(email: string, password: string) {
    const { token } = await this.login(email, password);
    await this.request.delete("/api/auth/profile", { headers: { Authorization: "Bearer " + token } });
  }
}`,
  component: `// pages/components/data-grid.component.ts: reusable across every grid in the app
import type { Locator } from "@playwright/test";

export class DataGrid {
  constructor(private readonly root: Locator) {}
  rows() { return this.root.getByRole("row"); }
  row(text: string | RegExp) { return this.rows().filter({ hasText: text }); }
  cell(rowText: string, header: string) {
    return this.row(rowText).getByRole("cell").nth(this.headerIndex(header));
  }
  private headerIndex(header: string) { return ["ID", "Name", "Department", "Status", "Score"].indexOf(header); }
}`,
  lint: `// .eslintrc.cjs: stop flaky patterns at review time
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "playwright"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:playwright/recommended"],
  rules: {
    "playwright/no-wait-for-timeout": "error",   // no fixed sleeps
    "playwright/no-force-option": "warn",
    "playwright/no-focused-test": "error",
    "playwright/expect-expect": "error",
    "@typescript-eslint/no-floating-promises": "error", // missing await = flaky test
  },
};`,
};
const JAVA = {
  tree: `testyard-selenium-java/
├─ pom.xml
├─ testng.xml                      # suites, parallel="methods" thread-count="4"
└─ src/
   ├─ main/java/dev/testyard/
   │  ├─ core/DriverFactory.java    # ThreadLocal<WebDriver>, browser from -Dbrowser
   │  ├─ core/Waits.java
   │  ├─ core/Config.java           # baseUrl, headless, timeouts
   │  ├─ pages/BasePage.java  AuthPage.java  ShopPage.java
   │  └─ api/ApiClient.java         # RestAssured helper
   └─ test/java/dev/testyard/
      ├─ BaseTest.java              # @BeforeMethod / @AfterMethod, screenshot on failure
      ├─ listeners/TestListener.java
      └─ tests/AuthTests.java  ShopTests.java`,
  pom: `<!-- pom.xml (excerpt) -->
<properties>
  <maven.compiler.release>21</maven.compiler.release>
  <selenium.version>4.27.0</selenium.version>
</properties>
<dependencies>
  <dependency><groupId>org.seleniumhq.selenium</groupId><artifactId>selenium-java</artifactId><version>\${selenium.version}</version></dependency>
  <dependency><groupId>org.testng</groupId><artifactId>testng</artifactId><version>7.10.2</version><scope>test</scope></dependency>
  <dependency><groupId>org.assertj</groupId><artifactId>assertj-core</artifactId><version>3.26.3</version><scope>test</scope></dependency>
  <dependency><groupId>io.rest-assured</groupId><artifactId>rest-assured</artifactId><version>5.5.0</version><scope>test</scope></dependency>
  <dependency><groupId>io.qameta.allure</groupId><artifactId>allure-testng</artifactId><version>2.29.0</version><scope>test</scope></dependency>
</dependencies>
<build><plugins><plugin>
  <artifactId>maven-surefire-plugin</artifactId><version>3.5.2</version>
  <configuration><suiteXmlFiles><suiteXmlFile>testng.xml</suiteXmlFile></suiteXmlFiles>
    <systemPropertyVariables><baseUrl>\${baseUrl}</baseUrl><browser>\${browser}</browser><headless>\${headless}</headless></systemPropertyVariables>
  </configuration>
</plugin></plugins></build>`,
  factory: `// core/DriverFactory.java: one driver per thread, safe for parallel TestNG
package dev.testyard.core;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.*;
import org.openqa.selenium.firefox.*;
import org.openqa.selenium.remote.RemoteWebDriver;
import java.net.URI;

public final class DriverFactory {
  private static final ThreadLocal<WebDriver> DRIVER = new ThreadLocal<>();
  private DriverFactory() {}

  public static WebDriver get() {
    if (DRIVER.get() == null) DRIVER.set(create());
    return DRIVER.get();
  }
  private static WebDriver create() {
    boolean headless = Boolean.parseBoolean(System.getProperty("headless", "true"));
    String grid = System.getProperty("gridUrl");          // e.g. http://localhost:4444
    switch (System.getProperty("browser", "chrome")) {
      case "firefox" -> { var o = new FirefoxOptions(); if (headless) o.addArguments("-headless"); return build(o, grid); }
      default -> { var o = new ChromeOptions(); if (headless) o.addArguments("--headless=new", "--window-size=1366,900"); return build(o, grid); }
    }
  }
  private static WebDriver build(org.openqa.selenium.Capabilities caps, String grid) {
    try {
      WebDriver d = grid == null ? (caps instanceof FirefoxOptions f ? new FirefoxDriver(f) : new ChromeDriver((ChromeOptions) caps))
                                 : new RemoteWebDriver(URI.create(grid).toURL(), caps);
      d.manage().timeouts().implicitlyWait(java.time.Duration.ZERO); // explicit waits only
      return d;
    } catch (Exception e) { throw new IllegalStateException(e); }
  }
  public static void quit() { var d = DRIVER.get(); if (d != null) { d.quit(); DRIVER.remove(); } }
}`,
  base: `// pages/BasePage.java: explicit waits, retry on stale, intent-level helpers
package dev.testyard.pages;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;
import java.time.Duration;

public abstract class BasePage {
  protected final WebDriver driver;
  protected final WebDriverWait wait;
  protected BasePage(WebDriver driver) { this.driver = driver; this.wait = new WebDriverWait(driver, Duration.ofSeconds(10)); }

  protected By tid(String id) { return By.cssSelector("[data-testid='" + id + "']"); }
  protected WebElement visible(By by) { return wait.until(ExpectedConditions.visibilityOfElementLocated(by)); }

  protected void click(By by) {
    wait.ignoring(StaleElementReferenceException.class).until(d -> { d.findElement(by).click(); return true; });
  }
  protected void type(By by, String text) { var e = visible(by); e.clear(); e.sendKeys(text); }
  protected String text(By by) { return visible(by).getText(); }
}`,
  test: `// tests/AuthTests.java
package dev.testyard.tests;

import dev.testyard.BaseTest;
import dev.testyard.pages.AuthPage;
import org.testng.annotations.*;
import static org.assertj.core.api.Assertions.assertThat;

public class AuthTests extends BaseTest {
  @Test(groups = "smoke")
  public void validLoginShowsProfile() {
    var auth = new AuthPage(driver());
    auth.open();
    auth.login("practice@testyard.dev", "SecretPass1!");
    assertThat(auth.profileName()).isEqualTo("Practice User");
  }

  @DataProvider(name = "badLogins")
  public Object[][] badLogins() { return new Object[][] { {"practice@testyard.dev", "nope"}, {"nobody@example.test", "SecretPass1!"} }; }

  @Test(dataProvider = "badLogins")
  public void invalidLoginShowsError(String email, String password) {
    var auth = new AuthPage(driver());
    auth.open();
    auth.login(email, password);
    assertThat(auth.errorText()).contains("Incorrect email address or password");
  }
}`,
  listener: `// listeners/TestListener.java: screenshot + page source on failure, attached to Allure
package dev.testyard.listeners;

import dev.testyard.core.DriverFactory;
import io.qameta.allure.Attachment;
import org.openqa.selenium.*;
import org.testng.*;

public class TestListener implements ITestListener {
  @Override public void onTestFailure(ITestResult result) {
    var d = DriverFactory.get();
    shot(((TakesScreenshot) d).getScreenshotAs(OutputType.BYTES));
    html(d.getPageSource());
  }
  @Attachment(value = "Screenshot", type = "image/png") private byte[] shot(byte[] b) { return b; }
  @Attachment(value = "Page source", type = "text/html") private String html(String s) { return s; }
}`,
  grid: `# docker-compose.yml: Selenium Grid 4 with three browsers
services:
  hub:
    image: selenium/hub:4.27.0
    ports: ["4444:4444"]
  chrome:
    image: selenium/node-chrome:4.27.0
    shm_size: 2g
    depends_on: [hub]
    environment: { SE_EVENT_BUS_HOST: hub, SE_NODE_MAX_SESSIONS: "4", SE_NODE_OVERRIDE_MAX_SESSIONS: "true" }
  firefox:
    image: selenium/node-firefox:4.27.0
    shm_size: 2g
    depends_on: [hub]
    environment: { SE_EVENT_BUS_HOST: hub, SE_NODE_MAX_SESSIONS: "4", SE_NODE_OVERRIDE_MAX_SESSIONS: "true" }

# run: mvn test -DgridUrl=http://localhost:4444 -Dbrowser=chrome -DbaseUrl=https://your-testyard.example.com`,
};
const PYX = {
  tree: `testyard-selenium-py/
├─ requirements.txt  pytest.ini  .env.example
├─ conftest.py                  # driver fixture, --browser/--base-url/--remote-url options, failure screenshots
├─ core/driver_factory.py  core/waits.py
├─ pages/base_page.py  auth_page.py  shop_page.py
├─ api/client.py
├─ tests/smoke/  tests/regression/  tests/api/
└─ reports/`,
  conftest: `# conftest.py: options, driver per test, screenshot on failure (pytest-html)
import os, pathlib, pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions

def pytest_addoption(parser):
    parser.addoption("--base-url", default=os.getenv("BASE_URL", "http://localhost:3000"))
    parser.addoption("--browser", default="chrome", choices=["chrome", "firefox"])
    parser.addoption("--remote-url", default=os.getenv("REMOTE_URL"))
    parser.addoption("--headed", action="store_true")

@pytest.fixture(scope="session")
def base_url(request): return request.config.getoption("--base-url")

@pytest.fixture
def driver(request):
    opt, headed, remote = request.config.getoption("--browser"), request.config.getoption("--headed"), request.config.getoption("--remote-url")
    o = ChromeOptions() if opt == "chrome" else FirefoxOptions()
    if not headed: o.add_argument("--headless=new" if opt == "chrome" else "-headless")
    if opt == "chrome": o.add_argument("--window-size=1366,900")
    d = webdriver.Remote(command_executor=remote, options=o) if remote else (webdriver.Chrome(options=o) if opt == "chrome" else webdriver.Firefox(options=o))
    d.implicitly_wait(0)   # explicit waits only
    request.node.driver = d
    yield d
    d.quit()

@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    out = yield
    rep = out.get_result()
    if rep.when == "call" and rep.failed and hasattr(item, "driver"):
        path = pathlib.Path("reports/screenshots"); path.mkdir(parents=True, exist_ok=True)
        item.driver.save_screenshot(str(path / f"{item.name}.png"))`,
  page: `# pages/base_page.py
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import StaleElementReferenceException

class BasePage:
    def __init__(self, driver, base_url, timeout=10):
        self.driver, self.base_url = driver, base_url
        self.wait = WebDriverWait(driver, timeout, ignored_exceptions=(StaleElementReferenceException,))

    @staticmethod
    def tid(test_id): return (By.CSS_SELECTOR, f'[data-testid="{test_id}"]')

    def open(self, path): self.driver.get(self.base_url + path)
    def click(self, locator): self.wait.until(EC.element_to_be_clickable(locator)).click()
    def type(self, locator, text):
        el = self.wait.until(EC.visibility_of_element_located(locator)); el.clear(); el.send_keys(text)
    def text(self, locator): return self.wait.until(EC.visibility_of_element_located(locator)).text
    def is_gone(self, locator): return self.wait.until(EC.invisibility_of_element_located(locator))`,
  test: `# tests/smoke/test_shop.py
import pytest
from pages.shop_page import ShopPage

@pytest.mark.smoke
def test_add_to_cart(driver, base_url):
    shop = ShopPage(driver, base_url); shop.open_shop()
    shop.add_first_product()
    assert shop.cart_count() == "1"

@pytest.mark.parametrize("category", ["Electronics", "Books", "Home", "Clothing"])
def test_each_category_has_products(driver, base_url, category):
    shop = ShopPage(driver, base_url); shop.open_shop(); shop.filter_by(category)
    assert shop.product_count() > 0`,
};
const BDD = {
  feature: `# features/login.feature (Cucumber / pytest-bdd / playwright-bdd all read this)
@smoke
Feature: Login
  Background:
    Given I am on the login page

  Scenario: Valid credentials
    When I log in as "practice@testyard.dev" with password "SecretPass1!"
    Then I see the profile name "Practice User"

  Scenario Outline: Invalid credentials
    When I log in as "<email>" with password "<password>"
    Then I see the error "Incorrect email address or password"
    Examples:
      | email                  | password    |
      | practice@testyard.dev  | wrong       |
      | nobody@example.test    | SecretPass1!|`,
  steps: `// steps/login.steps.ts (playwright-bdd): steps call page objects, never raw selectors
import { createBdd } from "playwright-bdd";
import { test } from "../fixtures";
const { Given, When, Then } = createBdd(test);

Given("I am on the login page", async ({ authPage }) => { await authPage.goto(); });
When("I log in as {string} with password {string}", async ({ authPage }, email: string, password: string) => { await authPage.login(email, password); });
Then("I see the profile name {string}", async ({ authPage, expect }, name: string) => { await expect(authPage.profileName).toHaveText(name); });
Then("I see the error {string}", async ({ authPage, expect }, msg: string) => { await expect(authPage.error).toContainText(msg); });`,
  rules: `BDD rules that keep it useful
- Write scenarios in business language; one behaviour per scenario; no CSS or URLs in .feature files.
- Steps are thin: they call page objects and API helpers. Reuse steps, do not copy them.
- Use Background for shared setup and Scenario Outline for data variation, not for flows with different logic.
- Treat the .feature files as living documentation: product, dev and QA review them together.
- Do not use BDD only because "it is standard": use it when non-engineers read and write the scenarios.`,
};
const EXTRA = {
  perf: `// k6 smoke/load test against the TestYard API (k6 run perf.js)
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [{ duration: "30s", target: 10 }, { duration: "1m", target: 10 }, { duration: "15s", target: 0 }],
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500"] },
};
const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const headers = { "X-Sandbox": "k6-" + __VU };
  const r = http.get(BASE + "/api/products?limit=12", { headers });
  check(r, { "status is 200": (x) => x.status === 200, "has items": (x) => x.json("data").length > 0 });
  sleep(1);
}`,
  a11y: `// tests/a11y/home.spec.ts: axe-core with @axe-core/playwright
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const path of ["/", "/practice/inputs", "/practice/shop"]) {
  test("no serious accessibility violations on " + path, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, serious.map((v) => v.id + ": " + v.help).join("\\n")).toEqual([]);
  });
}`,
  visual: `// tests/visual/shop.spec.ts: screenshot comparison (update with: npx playwright test --update-snapshots)
import { test, expect } from "@playwright/test";

test("product card layout is stable", async ({ page }) => {
  await page.goto("/practice/shop");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await expect(page).toHaveScreenshot("shop.png", {
    fullPage: true,
    animations: "disabled",
    mask: [page.getByTestId("api-status")],      // hide the volatile parts
    maxDiffPixelRatio: 0.01,
  });
});
// run snapshots in the same Docker image locally and in CI, or fonts will differ`,
  newman: `# Postman collection run (Newman) with data file and environment
newman run testyard.postman_collection.json \\
  --environment testyard.postman_environment.json \\
  --iteration-data users.csv \\
  --env-var baseUrl=http://localhost:3000 \\
  -r cli,htmlextra,junit

# import /api/openapi.json into Postman, Insomnia or Bruno to generate the collection`,
  contract: `// JSON-schema contract check with Ajv (Node) or jsonschema (Python)
import Ajv from "ajv";
const ajv = new Ajv({ allErrors: true });
const validateUser = ajv.compile({
  type: "object", required: ["id", "name", "job"],
  properties: { id: { type: "integer" }, name: { type: "string", minLength: 1 }, job: { type: "string" }, email: { type: "string", format: "email" } },
  additionalProperties: true,
});
// in a test: const body = (await res.json()).data; expect(validateUser(body), JSON.stringify(validateUser.errors)).toBe(true);`,
};
const ROADMAP = [
  ["Define goals and scope", "Without a goal the suite grows without direction.", "Write what the framework must protect (critical journeys, APIs, regressions), what it will not cover, and who maintains it.", "A one-page charter that the team has read and approved."],
  ["Choose the stack", "Tools are hard to swap later.", "Compare Playwright, Selenium, Cypress by language fit, browser support, speed, team skills. Pick runner, assertions, reporting and one language.", "A short decision record listing the choice and the alternatives rejected."],
  ["Apply the test pyramid", "UI tests are the slowest and flakiest layer.", "Decide what is checked at unit, API and UI level. Move every check you can below the UI. Keep UI tests for real user journeys.", "A written split such as 70% unit, 20% API, 10% UI with examples for each layer."],
  ["Create the project skeleton", "Structure decides how easily people add tests.", "Folders for pages, tests, fixtures, data, utilities. Lockfile, linting, formatting, TypeScript or type hints, .gitignore, README with a 5-minute start.", "A new teammate runs the first test within 10 minutes of cloning."],
  ["Environment configuration", "The same tests must run locally, in CI and against staging.", "Read BASE_URL, credentials and timeouts from environment variables with a validated config module. Provide .env.example. Never commit secrets.", "Switching environment needs one variable, with no code change."],
  ["Locator strategy", "Locators cause most maintenance.", "Prefer role, label and data-testid. Agree on test-id naming with developers. Ban absolute XPath and index-based CSS. Practise in the Locator Lab.", "A written locator priority list and a lint or review rule that enforces it."],
  ["Page Object Model and components", "Duplicated selectors make every UI change expensive.", "One class per page and per reusable component. Methods describe intent (login, addToCart). Expose locators as getters. No assertions inside page objects.", "Changing a selector means editing exactly one file."],
  ["Waits and synchronisation", "Fixed sleeps are slow and still flaky.", "Rely on auto-waiting (Playwright) or explicit waits (Selenium). Wait for state, not time: visible, enabled, response received. Ban sleep in code review.", "No sleep calls anywhere, and dynamic pages pass 50 times in a row."],
  ["Test data management", "Shared data makes tests order-dependent.", "Create data through the API per test with unique values (builders and factories), isolate with the X-Sandbox header, and clean up in fixtures.", "Any test can run alone, in any order and in parallel."],
  ["Authentication and sessions", "Logging in through the UI in every test wastes minutes.", "Log in once through the API and reuse storageState or cookies. Keep a separate test that covers the real login UI.", "Authenticated tests start already signed in, in under a second."],
  ["API layer", "Fast setup and direct contract checks.", "A typed client wrapping endpoints, with schema validation. Use it for setup, teardown and API-level tests.", "UI tests create state through the API, and every endpoint has contract tests."],
  ["Fixtures, hooks and test isolation", "Shared state hides bugs and breaks parallelism.", "Use fixtures for setup and teardown and a fresh browser context per test. Keep tests independent and idempotent.", "The suite passes with workers=1 and workers=8."],
  ["Assertions", "Weak assertions give false confidence.", "Use web-first, retrying assertions. Assert user-visible outcomes, not implementation details. Use soft assertions for multi-field checks.", "Each test has at least one meaningful assertion that fails when the feature breaks."],
  ["Reporting and diagnostics", "A red build must be explainable in 2 minutes.", "HTML and JUnit reports, screenshot, video and trace on failure, browser console and network logs, step names in the report.", "Every failure has a trace or screenshot attached."],
  ["Logging and error handling", "Silent failures waste debugging time.", "A small logger, test.step blocks, meaningful error messages with the locator and expected value. Capture console errors and failed requests.", "A failure message tells you what was expected and where."],
  ["Parallelism and speed", "A slow suite stops being run.", "Parallel workers, sharding, test tagging, and no heavy setup in every test. Measure the slowest 10 tests and fix them.", "Smoke under 10 minutes and full regression under 30 across shards."],
  ["Cross-browser and device coverage", "Users are not all on Chrome.", "Run the smoke set on every browser and device project, the full suite on one. Use projects, not copied tests.", "Browser matrix defined in config and run nightly."],
  ["Quality gates and code review", "Test code is production code.", "Lint, format, type check, pull request template, review checklist (locators, waits, data, naming), forbid .only.", "A pull request cannot merge with lint errors or committed .only."],
  ["CI/CD integration", "Tests that nobody runs do not protect anything.", "Run smoke on every pull request, regression on merge, full matrix nightly. Cache dependencies, publish reports, set required checks. See the CI/CD pages.", "Merging is blocked unless the pipeline is green."],
  ["Flaky test management", "Flakiness destroys trust.", "Retries only in CI and always reported, a quarantine tag with an owner and expiry, root-cause every flake (use the Flaky lab), and track the flake rate.", "Flake rate under 1% and no test is quarantined for more than two weeks."],
  ["Non-functional checks", "Functional green does not mean good.", "Add accessibility (axe), visual regression, performance budgets (k6, Lighthouse) and basic security headers checks where they pay off.", "At least one automated check in each of those areas on the critical path."],
  ["Documentation, onboarding and metrics", "Frameworks die when only one person understands them.", "README, contribution guide, architecture diagram, examples for every pattern. Track pass rate, duration, flake rate and coverage of critical journeys.", "A new engineer adds a passing test on day one, and the metrics dashboard is reviewed monthly."],
];
const MATURITY = [
  ["Foundations", ["Tests run from one command", "Config comes from environment variables", "Tests are independent and can run in any order", "Page objects or equivalent are used", "No fixed sleeps in the suite"]],
  ["Reliability", ["Failures attach screenshot, video or trace", "Retries limited and reported as flaky", "Quarantine process exists with owners", "Flake rate is measured weekly", "Test data is created and cleaned per test"]],
  ["Speed", ["Authentication is reused, not repeated in the UI", "Tests run in parallel", "Suite is sharded across machines in CI", "Slowest tests are reviewed monthly", "Smoke subset finishes in under 10 minutes"]],
  ["Delivery", ["Pipeline runs on every pull request", "Merge is blocked on a red pipeline", "Reports are published and linked", "Nightly cross-browser run exists", "Secrets live only in the CI secret store"]],
  ["Coverage", ["API contract tests exist", "Accessibility checks on key pages", "Visual checks on stable components", "Performance budget on key endpoints", "Critical journeys are mapped to tests"]],
];
const markdownOf = (sets) => Object.entries(sets).map(([tab, items]) => `## ${tab}\n\n` + items.map(([t, c]) => `### ${t}\n\n\`\`\`\n${c}\n\`\`\`\n`).join("\n")).join("\n");
page({
  id: "frameworks", group: "learn", title: "Build an automation framework",
  blurb: "A 22-step roadmap, a maturity checklist and deep starters for Playwright, Selenium, Cypress, API, BDD and more.",
  tasks: ["Follow the roadmap and create your own repo with the Playwright TypeScript starter.", "Automate login and the Dynamic loading pages with page objects and fixtures.", "Create test data through the API and reuse the session with storageState.", "Add a CI workflow that runs against your deployed TestYard URL (see the CI/CD pages).", "Add reports, failure traces, an accessibility check and a visual test.", "Score your framework with the maturity checklist and fix the lowest section."],
  render(root) {
    const sets = {
      "Playwright (TS)": [["Folder structure", PWTS.tree], ["playwright.config.ts", PWTS.config], ["Auth setup project", PWTS.auth], ["Fixtures", PWTS.fixtures], ["Page object", PWTS.page], ["Component object", PWTS.component], ["Specs", PWTS.spec], ["Test data factories", PWTS.factory], ["API client", PWTS.api], ["ESLint rules for flaky patterns", PWTS.lint]],
      "Playwright (JS)": [["Folder structure", PW.tree], ["playwright.config.js", PW.config], ["Page object", PW.pom], ["UI test", PW.spec], ["API test", PW.api], ["CI (GitHub Actions)", PW.ci]],
      "Selenium Python": [["Folder structure", PYX.tree], ["conftest.py", PYX.conftest], ["Base page", PYX.page], ["Tests", PYX.test], ["Simple starter", SEL.test]],
      "Selenium Java": [["Folder structure", JAVA.tree], ["pom.xml", JAVA.pom], ["DriverFactory", JAVA.factory], ["BasePage", JAVA.base], ["Tests (TestNG + AssertJ)", JAVA.test], ["Failure listener (Allure)", JAVA.listener], ["Selenium Grid (Docker)", JAVA.grid]],
      Cypress: [["Folder structure", CY.tree], ["Custom commands", CY.cmds], ["Specs", CY.spec]],
      "API testing": [["Folder structure", REST.tree], ["RestAssured", REST.ra], ["Python requests", REST.py], ["Newman / Postman", EXTRA.newman], ["Contract check (Ajv)", EXTRA.contract]],
      BDD: [["Feature file", BDD.feature], ["Step definitions", BDD.steps], ["Rules", BDD.rules]],
      "Non-functional": [["Performance (k6)", EXTRA.perf], ["Accessibility (axe)", EXTRA.a11y], ["Visual regression", EXTRA.visual]],
    };
    const names = Object.keys(sets).concat("Maturity checklist");
    const slug = (n) => n.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "");
    const panels = names.map((n, i) => h("div", { role: "tabpanel", hidden: i !== 0, "data-testid": "fw-panel-" + slug(n) }));
    sets[names[0]].forEach(([t, c]) => panels[0].append(code(t, c)));
    const filled = new Set([0]);
    const fillMaturity = (panel) => {
      const saved = new Set(store.get("fw.maturity", []));
      const score = h("p", { class: "mono", "data-testid": "fw-score" });
      const upd = () => { const total = MATURITY.reduce((a, [, l]) => a + l.length, 0); score.textContent = `Maturity: ${saved.size} of ${total} (${Math.round((saved.size / total) * 100)}%)`; };
      panel.append(score, ...MATURITY.map(([sec, items], si) => h("fieldset", { style: { border: "1px solid var(--line)", borderRadius: "9px", padding: "8px 14px", margin: "0 0 12px" } }, h("legend", { text: sec }), items.map((t, ii) => {
        const key = si + "-" + ii, cb = h("input", { type: "checkbox", id: "fw-m-" + key, "data-testid": "fw-m-" + key }); cb.checked = saved.has(key);
        cb.addEventListener("change", () => { cb.checked ? saved.add(key) : saved.delete(key); store.set("fw.maturity", [...saved]); upd(); });
        return h("label", { class: "check", for: "fw-m-" + key }, cb, t);
      }))));
      upd();
    };
    const tabBtns = names.map((n, i) => h("button", { role: "tab", "aria-selected": String(i === 0), "data-testid": "fw-tab-" + slug(n), type: "button" }, n));
    const tabs = h("div", { class: "tabs" }, h("div", { role: "tablist" }, tabBtns), panels);
    tabBtns.forEach((b, i) => b.addEventListener("click", () => {
      if (!filled.has(i)) { filled.add(i); if (i === names.length - 1) fillMaturity(panels[i]); else sets[names[i]].forEach(([t, c]) => panels[i].append(code(t, c))); }
      tabBtns.forEach((x, j) => x.setAttribute("aria-selected", String(i === j))); panels.forEach((p, j) => (p.hidden = i !== j));
    }));
    const q = h("input", { type: "search", placeholder: "Filter roadmap steps…", "aria-label": "Filter roadmap", "data-testid": "roadmap-filter" });
    const list = h("ol", { "data-testid": "roadmap", style: { paddingLeft: "22px", margin: "12px 0 0" } });
    const drawRoadmap = () => {
      const needle = q.value.trim().toLowerCase();
      list.replaceChildren(...ROADMAP.map((r, i) => ({ r, i })).filter(({ r }) => !needle || r.join(" ").toLowerCase().includes(needle)).map(({ r: [t, why, how, done], i }) => h("li", { value: i + 1, style: { marginBottom: "10px" } },
        h("details", {}, h("summary", { style: { cursor: "pointer" } }, h("b", { text: t })), h("div", { style: { padding: "8px 0 4px", color: "var(--muted)" } },
          h("p", { style: { margin: "0 0 6px" } }, h("b", { text: "Why: " }), why), h("p", { style: { margin: "0 0 6px" } }, h("b", { text: "How: " }), how), h("p", { style: { margin: "0" } }, h("b", { text: "Done when: " }), done))))));
      if (!list.children.length) list.append(h("li", { class: "muted", text: "No steps match." }));
    };
    q.addEventListener("input", drawRoadmap); drawRoadmap();
    const all = h("button", { class: "btn sm", type: "button", "data-testid": "fw-copy-all", onClick: () => copy(markdownOf(sets)) }, "Copy every starter as Markdown");
    root.append(
      stage(h("div", { class: "row", style: { justifyContent: "space-between" } }, h("h2", { text: `Roadmap (${ROADMAP.length} steps)`, style: { margin: 0 } }), q), list),
      stage(h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "10px" } }, h("h2", { text: "Starter code", style: { margin: 0 } }), all), tabs, h("p", { class: "hint", html: "Runnable starters live in the repository under <code>frameworks/playwright</code> and <code>frameworks/selenium-python</code>. CI examples are on the <a href=\"/practice/cicd-pipeline\">CI/CD pages</a>." })));
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
