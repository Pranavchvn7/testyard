import { page } from "../registry.js";
import { h, copy, stage, field } from "../ui.js";

// Playwright fixtures: concept guide, a live scope simulator, a to-do app for page-object fixtures and advanced patterns.
const code = (title, text, id) => h("div", { style: { marginBottom: "16px" } },
  h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "6px" } },
    h("b", { class: "mono", text: title }),
    h("button", { class: "btn sm", type: "button", "data-testid": "copy-" + id, onClick: () => copy(text) }, "Copy")),
  h("pre", { "data-testid": id, text }));
const points = (items) => h("ul", { style: { paddingLeft: "20px", margin: "0 0 12px" } }, items.map(([b, t]) => h("li", { style: { marginBottom: "6px" } }, h("b", { text: b + ": " }), t)));

const SAMPLES = {
  basics: `// fixtures.ts
import { test as base, expect } from "@playwright/test";

type Fixtures = { greeting: string };

export const test = base.extend<Fixtures>({
  // setup runs BEFORE use(), teardown runs AFTER it, even when the test fails
  greeting: async ({}, use) => {
    // ...create resources here...
    await use("hello");
    // ...clean them up here...
  },
});
export { expect };

// example.spec.ts
import { test, expect } from "./fixtures";

test("uses the fixture", async ({ greeting }) => {
  expect(greeting).toBe("hello");
});`,
  testScope: `// TEST scope (the default): a fresh value for every test that asks for it
type Fixtures = { note: { id: number; token: string } };

export const test = base.extend<Fixtures>({
  note: async ({ request }, use) => {
    const email = \`user-\${Date.now()}-\${Math.random().toString(36).slice(2)}@example.test\`;
    await request.post("/api/auth/register", { data: { name: "Fixture User", email, password: "Passw0rd!" } });
    const login = await request.post("/api/auth/login", { data: { email, password: "Passw0rd!" } });
    const { token } = (await login.json()).data;
    const created = await request.post("/api/notes", {
      headers: { Authorization: \`Bearer \${token}\` },
      data: { title: "Fixture note", description: "created by a fixture", category: "Work" },
    });
    const { id } = (await created.json()).data;

    await use({ id, token });                                  // the test runs here

    await request.delete("/api/auth/profile", { headers: { Authorization: \`Bearer \${token}\` } }); // teardown
  },
});`,
  workerScope: `// WORKER scope: created once per worker process and shared by all its tests
type WorkerFixtures = { account: { email: string; password: string } };

export const test = base.extend<{}, WorkerFixtures>({
  account: [async ({ playwright }, use, workerInfo) => {
    // worker fixtures cannot use test-scoped fixtures such as page or request, so build a context yourself
    const api = await playwright.request.newContext({
      baseURL: process.env.BASE_URL ?? "http://localhost:3000",
      extraHTTPHeaders: { "X-Sandbox": \`worker-\${workerInfo.workerIndex}\` },
    });
    const account = { email: \`worker\${workerInfo.workerIndex}-\${Date.now()}@example.test\`, password: "Passw0rd!" };
    await api.post("/api/auth/register", { data: { name: "Worker User", ...account } });

    await use(account);

    await api.dispose();
  }, { scope: "worker" }],
});

// Rule of thumb: put slow, read-only, shareable setup in worker scope.
// Anything a test mutates belongs in test scope, or tests will affect each other.`,
  pom: `// pages/TodoPage.ts
import { type Locator, type Page, expect } from "@playwright/test";

export class TodoPage {
  readonly input: Locator;
  readonly items: Locator;
  readonly count: Locator;
  constructor(private readonly page: Page) {
    this.input = page.getByTestId("todo-input");
    this.items = page.getByTestId("todo-item");
    this.count = page.getByTestId("todo-count");
  }
  async goto() { await this.page.goto("/practice/playwright-fixtures?tab=pom"); }
  async add(text: string) {
    await this.input.fill(text);
    await this.page.getByTestId("todo-add").click();
  }
  async complete(text: string) {
    await this.items.filter({ hasText: text }).getByTestId("todo-check").check();
  }
  async expectCount(n: number) { await expect(this.items).toHaveCount(n); }
}

// pages/LoginPage.ts
export class LoginPage {
  constructor(private readonly page: Page) {}
  async goto() { await this.page.goto("/practice/auth"); }
  async login(email: string, password: string) {
    await this.page.getByLabel("Email").fill(email);
    await this.page.getByLabel("Password").fill(password);
    await this.page.getByRole("button", { name: "Log in", exact: true }).click();
  }
}

// fixtures.ts: page objects become fixtures, so tests never call "new TodoPage(page)"
import { test as base } from "@playwright/test";
import { TodoPage } from "./pages/TodoPage";
import { LoginPage } from "./pages/LoginPage";

export const test = base.extend<{ todoPage: TodoPage; loginPage: LoginPage }>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();                 // setup that every test needs
    await use(todoPage);
  },
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
});
export { expect } from "@playwright/test";

// todo.spec.ts
import { test, expect } from "./fixtures";

test("adds and completes a todo", async ({ todoPage }) => {
  await todoPage.add("Write fixtures");
  await todoPage.complete("Write fixtures");
  await expect(todoPage.count).toHaveText("0 items left");
});`,
  auto: `// AUTO fixture: runs for every test without being requested
export const test = base.extend<{ consoleErrors: void }>({
  consoleErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await use();
    expect(errors, "unexpected page errors").toEqual([]);
  }, { auto: true }],
});`,
  option: `// OPTION fixture: a configurable value, overridden with test.use() or in playwright.config
type Options = { defaultItem: string };

export const test = base.extend<Options & { todoPage: TodoPage }>({
  defaultItem: ["Buy milk", { option: true }],
  todoPage: async ({ page, defaultItem }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.add(defaultItem);
    await use(todoPage);
  },
});

test.describe("with a custom item", () => {
  test.use({ defaultItem: "Walk the dog" });
  test("starts with that item", async ({ todoPage }) => {
    await expect(todoPage.items).toHaveText(["Walk the dog"]);
  });
});`,
  depend: `// Fixtures can depend on each other; Playwright builds them in dependency order
export const test = base.extend<{ authedPage: Page; profile: { name: string } }>({
  authedPage: async ({ page }, use) => {
    await page.goto("/practice/auth");
    await page.getByLabel("Email").fill("practice@testyard.dev");
    await page.getByLabel("Password").fill("SecretPass1!");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByTestId("profile-name")).toBeVisible();
    await use(page);
  },
  profile: async ({ authedPage }, use) => {
    await use({ name: (await authedPage.getByTestId("profile-name").textContent()) ?? "" });
  },
});

// Override a built-in fixture for one file or project
test.use({ viewport: { width: 390, height: 844 } });`,
  merge: `// mergeTests: combine fixtures from separate files
import { mergeTests } from "@playwright/test";
import { test as todoTest } from "./todo-fixtures";
import { test as apiTest } from "./api-fixtures";

export const test = mergeTests(todoTest, apiTest);

// Fixture options: a readable name in reports, a custom timeout, hide from the call stack
foo: [async ({}, use) => { await use(1); }, { title: "Seed database", timeout: 60_000, box: true }],`,
};

// ---------------------------------------------------------------- simulator
const TESTS = [1, 2, 3, 4, 5, 6];
function Simulator() {
  const state = { running: false, cancel: false };
  const workers = h("select", { id: "sim-workers", "data-testid": "sim-workers", "aria-label": "Workers" }, [1, 2, 3].map((n) => h("option", { value: String(n), text: `${n} worker${n > 1 ? "s" : ""}` })));
  workers.value = "2";
  const scope = h("select", { id: "sim-scope", "data-testid": "sim-scope", "aria-label": "Scope of the db fixture" }, h("option", { value: "worker", text: "worker" }), h("option", { value: "test", text: "test" }));
  const parallel = h("input", { type: "checkbox", id: "sim-parallel", "data-testid": "sim-parallel", checked: true });
  const fail3 = h("input", { type: "checkbox", id: "sim-fail3", "data-testid": "sim-fail3" });
  const status = h("p", { class: "mono", role: "status", "aria-live": "polite", "data-testid": "sim-status", text: "Press “Run 6 tests” to start." });
  const cTest = h("b", { "data-testid": "count-test-setups", text: "0" });
  const cWorker = h("b", { "data-testid": "count-db-setups", text: "0" });
  const cTear = h("b", { "data-testid": "count-db-teardowns", text: "0" });
  const cWorkers = h("b", { "data-testid": "count-workers-started", text: "0" });
  const logs = h("div", { class: "grid g3", "data-testid": "sim-logs", style: { alignItems: "start" } });
  const run = h("button", { class: "btn primary", type: "button", "data-testid": "sim-run" }, "Run 6 tests");
  const reset = h("button", { class: "btn", type: "button", "data-testid": "sim-reset" }, "Reset");

  const resetAll = () => {
    state.cancel = true;
    cTest.textContent = cWorker.textContent = cTear.textContent = cWorkers.textContent = "0";
    logs.replaceChildren(); status.textContent = "Press “Run 6 tests” to start."; run.disabled = false;
  };
  reset.addEventListener("click", resetAll);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  run.addEventListener("click", async () => {
    if (state.running) return;
    resetAll(); state.cancel = false; state.running = true; run.disabled = true;
    const n = Number(workers.value), dbScope = scope.value, fully = parallel.checked, failing = fail3.checked;
    // Playwright gives each worker whole files; tests in ONE file only spread across workers with fullyParallel
    const used = fully ? n : 1;
    const queues = Array.from({ length: used }, () => []);
    TESTS.forEach((t, i) => queues[i % used].push(t));
    const cols = queues.map((q, i) => {
      const ul = h("ol", { "data-testid": `sim-log-w${i + 1}`, style: { paddingLeft: "18px", margin: 0, fontSize: ".82rem", minHeight: "40px" } });
      logs.append(h("div", { class: "stage", "data-testid": `sim-worker-${i + 1}` }, h("h3", { style: { margin: "0 0 6px" }, text: `Worker ${i + 1}` }), h("p", { class: "muted", style: { margin: "0 0 6px" }, text: q.length ? `tests ${q.join(", ")}` : "idle" }), ul));
      return ul;
    });
    let testSetups = 0, dbSetups = 0, dbTeardowns = 0, started = 0;
    const sync = () => { cTest.textContent = String(testSetups); cWorker.textContent = String(dbSetups); cTear.textContent = String(dbTeardowns); cWorkers.textContent = String(started); };
    const say = (ul, text, kind = "") => { ul.append(h("li", { class: kind, "data-testid": "sim-event", text })); };

    await Promise.all(queues.map(async (q, wi) => {
      const ul = cols[wi]; if (!q.length) return;
      let dbUp = false;
      started++; say(ul, "worker process started"); sync();
      for (let k = 0; k < q.length; k++) {
        const t = q[k]; if (state.cancel) return;
        await sleep(260);
        if (dbScope === "worker") { if (!dbUp) { dbUp = true; dbSetups++; say(ul, `setup db (worker scope)`, "ok"); } } else { dbSetups++; say(ul, `test ${t}: setup db (test scope)`, "ok"); }
        testSetups++; say(ul, `test ${t}: setup page fixture`); sync();
        await sleep(260); if (state.cancel) return;
        const bad = failing && t === 3;
        say(ul, `test ${t}: ${bad ? "FAILED" : "passed"}`, bad ? "bad" : "ok");
        say(ul, `test ${t}: teardown page fixture`);
        if (dbScope === "test") { dbTeardowns++; say(ul, `test ${t}: teardown db`); }
        sync();
        if (bad && dbScope === "worker" && dbUp) {
          dbTeardowns++; dbUp = false; say(ul, "teardown db (worker discarded after failure)", "warn");
          if (k < q.length - 1) { started++; say(ul, "new worker process started for remaining tests"); }
          sync();
        } else if (bad && k < q.length - 1) { started++; say(ul, "new worker process started for remaining tests"); sync(); }
      }
      if (dbScope === "worker" && dbUp) { dbTeardowns++; say(ul, "teardown db (worker scope, all tests done)", "ok"); sync(); }
    }));
    if (!state.cancel) {
      status.textContent = `Done: db set up ${dbSetups}×, torn down ${dbTeardowns}× · page fixture set up ${testSetups}× · worker processes started ${started}.`;
    }
    state.running = false; run.disabled = false;
  });

  return h("div", {},
    stage(h("h2", { text: "Fixture scope simulator" }),
      h("p", { class: "muted", text: "Six tests run in one file. A `page` fixture is test-scoped. Choose the scope of an expensive `db` fixture and watch how often it is built." }),
      h("div", { class: "row", style: { marginBottom: "10px" } },
        field("Workers", workers), field("Scope of `db`", scope),
        h("label", { class: "check", for: "sim-parallel" }, parallel, "fullyParallel"),
        h("label", { class: "check", for: "sim-fail3" }, fail3, "Test 3 fails")),
      h("div", { class: "row", style: { marginBottom: "10px" } }, run, reset),
      status,
      h("p", { "data-testid": "sim-counters" }, "db setups ", cWorker, " · db teardowns ", cTear, " · page fixture setups ", cTest, " · workers started ", cWorkers),
      logs),
    stage(h("h2", { text: "What to notice" }), points([
      ["Worker scope", "db is set up once per worker, so 2 workers means 2 setups for 6 tests."],
      ["Test scope", "db is set up and torn down 6 times, once per test. Safer isolation, slower suite."],
      ["fullyParallel off", "Tests in a single file all run in worker 1, so extra workers sit idle."],
      ["A failing test", "Playwright discards the worker and starts a new one, so a worker-scoped fixture is rebuilt afterwards."],
    ])));
}

// ---------------------------------------------------------------- to-do app
function TodoApp() {
  let items = [], nextId = 1, filter = "all";
  const input = h("input", { id: "todo-input", "data-testid": "todo-input", placeholder: "What needs to be done?", "aria-label": "New todo" });
  const err = h("div", { role: "alert", "data-testid": "todo-error", class: "alert bad", style: { display: "none" } });
  const ul = h("ul", { "data-testid": "todo-list", style: { listStyle: "none", padding: 0, margin: "12px 0" } });
  const count = h("p", { "data-testid": "todo-count", "aria-live": "polite" });
  const filterBtns = ["all", "active", "completed"].map((f) => h("button", { class: "btn sm", type: "button", "data-testid": "todo-filter-" + f, "aria-pressed": String(f === "all"), onClick: () => { filter = f; draw(); } }, f[0].toUpperCase() + f.slice(1)));
  const clear = h("button", { class: "btn sm", type: "button", "data-testid": "todo-clear" }, "Clear completed");
  const draw = () => {
    filterBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(["all", "active", "completed"][i] === filter)));
    const vis = items.filter((i) => filter === "all" || (filter === "active" ? !i.done : i.done));
    ul.replaceChildren(...vis.map((i) => h("li", { "data-testid": "todo-item", class: i.done ? "done" : "", style: { display: "flex", gap: "8px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" } },
      h("input", { type: "checkbox", checked: i.done, "aria-label": `Complete ${i.text}`, "data-testid": "todo-check", onChange: (e) => { i.done = e.target.checked; draw(); } }),
      h("span", { style: { flex: 1, textDecoration: i.done ? "line-through" : "none" }, text: i.text }),
      h("button", { class: "btn sm", type: "button", "data-testid": "todo-delete", "aria-label": `Delete ${i.text}`, onClick: () => { items = items.filter((x) => x.id !== i.id); draw(); } }, "Delete"))));
    const left = items.filter((i) => !i.done).length;
    count.textContent = `${left} item${left === 1 ? "" : "s"} left`;
    clear.disabled = !items.some((i) => i.done);
  };
  const add = () => {
    const text = input.value.trim();
    if (!text) { err.textContent = "Enter a todo first"; err.style.display = ""; return; }
    if (items.some((i) => i.text.toLowerCase() === text.toLowerCase())) { err.textContent = "That todo already exists"; err.style.display = ""; return; }
    err.style.display = "none"; items.push({ id: nextId++, text, done: false }); input.value = ""; draw();
  };
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
  clear.addEventListener("click", () => { items = items.filter((i) => !i.done); draw(); });
  draw();
  return stage(h("h2", { text: "Practice app: Todo" }),
    h("div", { class: "row" }, input, h("button", { class: "btn primary", type: "button", "data-testid": "todo-add", onClick: add }, "Add")),
    err, ul, count, h("div", { class: "row" }, ...filterBtns, clear));
}

page({
  id: "playwright-fixtures", group: "playwright", title: "Fixtures: scopes & page objects",
  blurb: "Learn test.extend: test and worker scope, page-object fixtures, auto and option fixtures, with a simulator and a Todo app to practise on.",
  tasks: [
    "Run the simulator with worker scope and 2 workers and assert db setups is 2. Switch to test scope and assert it is 6.",
    "Turn fullyParallel off and assert that only Worker 1 lists tests.",
    "Tick “Test 3 fails” with worker scope and explain why workers started becomes 3 (use sim-event entries).",
    "Build a TodoPage page object and expose it as a todoPage fixture with test.extend.",
    "Write a test that adds two todos, completes one and asserts “1 item left”.",
    "Add a duplicate todo and assert the todo-error message; then add an empty one.",
    "Create an option fixture defaultItem and override it with test.use().",
    "Write an auto fixture that fails the test when a page error occurs.",
  ],
  render(root) {
    const TABS = ["Guide", "Scopes", "POM fixtures", "Advanced"];
    const keyOf = (n) => n.toLowerCase().replace(/\W+/g, "-");
    const qs = new URLSearchParams(location.search).get("tab");
    let active = TABS.find((n) => keyOf(n) === qs || (qs === "pom" && n === "POM fixtures")) || TABS[0];
    const panels = {
      "Guide": () => h("div", {},
        stage(h("h2", { text: "What is a fixture?" }),
          h("p", { text: "A fixture is a named piece of setup and teardown that Playwright builds for a test and hands over as an argument. The built-in `page`, `context`, `request` and `browser` are fixtures; test.extend lets you add your own." }),
          points([
            ["Declarative", "Tests ask for what they need by name: ({ page, todoPage })."],
            ["Lazy", "A fixture is only set up when a test (or another fixture) uses it, unless it is an auto fixture."],
            ["Isolated", "Test-scoped fixtures give each test a fresh value; worker-scoped ones are shared by a worker's tests."],
            ["Reliable cleanup", "Code after use() always runs, even when the test fails, so you never leak state."],
          ])),
        stage(h("h2", { text: "Fixtures vs hooks" }), h("div", { class: "tbl-wrap" }, h("table", { "data-testid": "fixtures-vs-hooks" },
          h("thead", {}, h("tr", {}, ["", "beforeEach / afterEach", "Fixtures"].map((t) => h("th", { text: t })))),
          h("tbody", {}, [["Setup and teardown", "Two separate functions", "One function around use()"], ["Reuse across files", "Copy or helper", "Import the extended test"], ["Runs for", "Every test in scope", "Only tests that use it (or auto)"], ["Dependencies", "Manual ordering", "Resolved automatically"], ["Scope", "Per test", "Test or worker"]].map((r) => h("tr", {}, r.map((c, i) => h(i ? "td" : "th", { text: c }))))))),),
        stage(h("h2", { text: "The shape of a fixture" }), code("fixtures.ts", SAMPLES.basics, "ref-basics"))),
      "Scopes": () => h("div", {}, Simulator(),
        stage(h("h2", { text: "Test scope in code" }), code("note fixture (test scope)", SAMPLES.testScope, "ref-test-scope")),
        stage(h("h2", { text: "Worker scope in code" }), code("account fixture (worker scope)", SAMPLES.workerScope, "ref-worker-scope"))),
      "POM fixtures": () => h("div", { class: "grid g2", style: { alignItems: "start" } }, TodoApp(),
        stage(h("h2", { text: "Page objects as fixtures" }), code("TodoPage, LoginPage and fixtures.ts", SAMPLES.pom, "ref-pom"))),
      "Advanced": () => h("div", {},
        stage(h("h2", { text: "Auto fixtures" }), code("consoleErrors", SAMPLES.auto, "ref-auto")),
        stage(h("h2", { text: "Option fixtures" }), code("defaultItem", SAMPLES.option, "ref-option")),
        stage(h("h2", { text: "Dependencies and overrides" }), code("authedPage and profile", SAMPLES.depend, "ref-depend")),
        stage(h("h2", { text: "Merging and options" }), code("mergeTests", SAMPLES.merge, "ref-merge"))),
    };
    const body = h("div", { "data-testid": "fx-body" });
    const tabs = TABS.map((n) => h("button", { role: "tab", type: "button", "data-testid": "fx-tab-" + keyOf(n), onClick: () => { active = n; draw(); } }, n));
    function draw() {
      tabs.forEach((b, i) => b.setAttribute("aria-selected", String(TABS[i] === active)));
      body.replaceChildren(panels[active]());
    }
    root.append(h("div", { class: "tabs" }, h("div", { role: "tablist" }, tabs)), body);
    draw();
  },
});
