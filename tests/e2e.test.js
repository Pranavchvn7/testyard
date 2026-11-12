// End-to-end smoke tests (Playwright library + node:test). Skipped automatically if Playwright is not installed.
// Run: npm i -D playwright && npx playwright install chromium && npm run test:e2e
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch { /* not installed */ }
const skip = !chromium && "playwright not installed";

const PORT = 3200 + Math.floor(Math.random() * 500);
const URL = `http://localhost:${PORT}`;
let server, browser, page;

before(async () => {
  if (skip) return;
  server = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { try { if ((await fetch(URL + "/api/health")).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 100)); }
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.kill(); });

const open = async (hash) => {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  // Content-Security-Policy violations arrive as console errors; the only expected noise is the intentionally broken images.
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) p.errors.push(m.text()); });
  await p.goto(`${URL}/${hash ? "practice/" + hash : ""}`);
  return p;
};
const tid = (p, id) => p.getByTestId(id);

test("every page renders without JavaScript errors", { skip }, async () => {
  const p = await open("");
  const ids = await p.$$eval("#nav a", (as) => as.map((a) => a.getAttribute("href").replace("/practice/", "")));
  assert.ok(ids.length >= 40, "expected 40+ pages, got " + ids.length);
  for (const id of ids) {
    await p.goto(`${URL}/practice/${id}`);
    await p.waitForSelector(`[data-testid="page-${id}"]`);
    await p.waitForTimeout(150);
  }
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test("form validation and success", { skip }, async () => {
  const p = await open("inputs");
  await tid(p, "submit").click();
  assert.match(await p.locator("#err-email").textContent(), /valid email/);
  await p.fill("#firstName", "Asha"); await p.fill("#email", "a@b.co"); await p.fill("#phone", "1234567890");
  await p.fill("#password", "Password1"); await p.fill("#age", "30");
  await tid(p, "gender-female").check(); await tid(p, "country").selectOption("Canada");
  await tid(p, "submit").click();
  await tid(p, "form-success").waitFor();
  assert.match(await tid(p, "result").textContent(), /"firstName": "Asha"/);
  await p.context().close();
});

test("drag and drop, sortable list", { skip }, async () => {
  const p = await open("dragdrop");
  await tid(p, "drag-me").dragTo(tid(p, "drop-zone"));
  assert.match(await tid(p, "drop-zone").getAttribute("class"), /filled/);
  await tid(p, "sort-gamma").dragTo(tid(p, "sort-alpha"));
  assert.match(await tid(p, "sort-order").textContent(), /^Order: Gamma/);
  await p.context().close();
});

test("dynamic loading waits for the element", { skip }, async () => {
  const p = await open("dynamic-loading");
  await tid(p, "start-rendered").click();
  await tid(p, "finish-rendered").waitFor({ timeout: 6000 });
  assert.equal(await tid(p, "finish-rendered").textContent(), "Hello World!");
  await p.context().close();
});

test("data grid sorts, filters and paginates", { skip }, async () => {
  const p = await open("table-grid");
  assert.equal(await tid(p, "grid-row").count(), 10);
  await tid(p, "sort-score").click(); await tid(p, "sort-score").click();
  const scores = await p.$$eval("[data-testid=grid-row] td:nth-child(6)", (t) => t.map((x) => +x.textContent));
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  await tid(p, "grid-dept").selectOption("QA");
  const depts = await p.$$eval("[data-testid=grid-row] td:nth-child(4)", (t) => [...new Set(t.map((x) => x.textContent))]);
  assert.deepEqual(depts, ["QA"]);
  await p.context().close();
});

test("login, notes CRUD through the real API", { skip }, async () => {
  const p = await open("auth");
  await tid(p, "login-email").fill("practice@testyard.dev");
  await tid(p, "login-password").fill("SecretPass1!");
  await tid(p, "login-submit").click();
  assert.equal(await tid(p, "profile-name").textContent(), "Practice User");
  await p.goto(`${URL}/practice/notes`);
  await tid(p, "note-add").click();
  await tid(p, "msg-error").waitFor();
  assert.match(await tid(p, "note-msg").textContent(), /Validation failed/);
  await tid(p, "note-title").fill("Write more tests"); await tid(p, "note-desc").fill("cover shop");
  await tid(p, "note-add").click();
  await tid(p, "note-card").waitFor();
  await tid(p, "note-done").check();
  await p.waitForFunction(() => document.querySelector("[data-testid=note-title-text]")?.style.textDecoration.includes("line-through"));
  await tid(p, "note-delete").click();
  await tid(p, "note-empty").waitFor();
  await p.context().close();
});

test("shop: free shipping over $75 and order creation", { skip }, async () => {
  const p = await open("shop");
  await tid(p, "product-card").first().waitFor();
  await tid(p, "shop-category").selectOption("Electronics");
  await p.waitForFunction(() => document.querySelectorAll("[data-testid=product-card]").length > 0);
  await tid(p, "add-to-cart").first().click();     // Mechanical Keyboard 89.99
  assert.equal(await tid(p, "shipping").textContent(), "FREE");
  await tid(p, "checkout").click();
  await tid(p, "co-name").fill("Jane Tester"); await tid(p, "co-email").fill("jane@example.test"); await tid(p, "co-address").fill("1 Test Street");
  await tid(p, "place-order").click();
  const id = await tid(p, "order-id").textContent();
  assert.match(id, /^\d{4}$/);
  await p.context().close();
});

test("flight wizard validates and completes", { skip }, async () => {
  const p = await open("flights");
  await tid(p, "from").selectOption("Delhi (DEL)"); await tid(p, "to").selectOption("Delhi (DEL)");
  await tid(p, "depart").fill("2030-01-15");
  await tid(p, "search").click();
  assert.match(await tid(p, "search-error").textContent(), /must differ/);
  await tid(p, "to").selectOption("London (LHR)"); await tid(p, "search").click();
  await tid(p, "select-flight").first().click();
  await tid(p, "pax-name-1").fill("Asha Verma"); await tid(p, "pax-email-1").fill("asha@example.test");
  await tid(p, "to-payment").click();
  await tid(p, "card").fill("4242 4242 4242 4242"); await tid(p, "exp").fill("12/30"); await tid(p, "cvc").fill("123");
  await tid(p, "pay").click();
  assert.match(await tid(p, "booking-ref").textContent(), /^TY-[A-Z0-9]{6}$/);
  await p.context().close();
});

test("shadow DOM, iframe and dialogs", { skip }, async () => {
  let p = await open("shadow");
  await p.locator("ty-card[data-testid=shadow-host] input").fill("hello");
  await p.locator("ty-card[data-testid=shadow-host] button").click();
  assert.equal(await p.locator("ty-card[data-testid=shadow-host] #shadow-out").textContent(), "Result: hello");
  p = await open("frames");
  const deep = p.frameLocator("iframe[name=outer-frame]").frameLocator("iframe[name=inner-frame]");
  await deep.locator("#deep-btn").click();
  assert.equal(await deep.locator("#deep-btn").textContent(), "Deep click ✔");
  p = await open("dialogs");
  p.once("dialog", (d) => d.accept("Sam"));
  await tid(p, "js-prompt").click();
  assert.match(await tid(p, "dialog-out").textContent(), /Hello, Sam/);
  await p.context().close();
});

test("selector tester counts matches", { skip }, async () => {
  const p = await open("selector-tester");
  await tid(p, "st-selector").fill("li.item");
  assert.equal(await tid(p, "st-count").textContent(), "3");
  await tid(p, "st-mode").selectOption("xpath");
  await tid(p, "st-selector").fill("//li[@data-price>2]");
  assert.equal(await tid(p, "st-count").textContent(), "2");
  await p.context().close();
});

test("API console sends a request", { skip }, async () => {
  const p = await open("api-console");
  await tid(p, "c-url").fill("/api/status/418");
  await tid(p, "c-send").click();
  await p.waitForFunction(() => document.querySelector("[data-testid=c-status]")?.textContent.startsWith("418"));
  await p.context().close();
});
