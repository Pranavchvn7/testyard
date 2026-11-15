import { page } from "../registry.js";
import { h, $, $$, toast, stage, field, sleep, rand, api, copy, store, auth, sandboxId, pretty } from "../ui.js";

// Playwright lab: every page is a real, automatable target plus a reference solution written with @playwright/test.
const G = "playwright";
const ref = (title, code, id = "reference-solution") => h("details", { class: "pw-ref", "data-testid": id },
  h("summary", { text: "Reference solution: " + title }),
  h("div", { class: "row", style: { margin: "8px 0" } }, h("button", { class: "btn sm", type: "button", "data-testid": "copy-" + id, onClick: () => copy(code) }, "Copy")),
  h("pre", { text: code }));
const btn = (label, id, fn, cls = "") => h("button", { class: "btn " + cls, type: "button", "data-testid": id, onClick: fn }, label);
const out = (id, text = "—") => h("pre", { "data-testid": id, "aria-live": "polite" }, text);
const timersOf = () => { const list = []; return { later: (fn, ms) => { const t = setTimeout(fn, ms); list.push(["t", t]); return t; }, every: (fn, ms) => { const t = setInterval(fn, ms); list.push(["i", t]); return t; }, clear: () => list.splice(0).forEach(([k, t]) => (k === "t" ? clearTimeout(t) : clearInterval(t))) }; };

// ---------------------------------------------------------------- 1 actionability
page({
  id: "playwright-actionability", group: G, title: "Actionability checks",
  blurb: "Disabled, covered, moving, off-screen and re-rendered elements: see what Playwright waits for before it acts.",
  tasks: [
    "Click “Submit order” right after pressing “Enable in 2 s”: no sleep, Playwright waits for enabled.",
    "Click the covered button; read the “intercepts pointer events” retry log from the call log, then remove the overlay.",
    "Click the moving button and explain the stable check; then stop the animation and compare.",
    "Click the off-screen button inside the scroll box and confirm Playwright scrolled it into view.",
    "Use fill() on the read-only input: observe the wait for editable, then use force or wait for the unlock.",
    "Use hover() to reveal the hidden button, then click it. Try locator.click({ trial: true }) first.",
    "Click the re-rendering button twice in a row and explain why the locator never goes stale.",
    "Use check(), uncheck() and setChecked() on the checkbox and assert with toBeChecked().",
  ],
  render(root) {
    const T = timersOf();
    const log = h("ul", { "data-testid": "act-log", "aria-label": "Action log", style: { paddingLeft: "18px", minHeight: "60px" } });
    const say = (m) => { log.prepend(h("li", { text: m })); while (log.children.length > 8) log.lastChild.remove(); };

    const dis = h("button", { class: "btn primary", type: "button", disabled: true, "data-testid": "act-disabled" }, "Submit order");
    dis.addEventListener("click", () => say("Submit order clicked"));
    const en = btn("Enable in 2 s", "act-enable-start", () => { en.disabled = true; T.later(() => { dis.disabled = false; en.disabled = false; say("Submit order is now enabled"); }, 2000); });

    const overlay = h("div", { class: "pw-overlay", "data-testid": "act-overlay", role: "presentation" }, "Loading…");
    const covered = btn("Covered button", "act-covered", () => say("Covered button clicked"), "primary");
    const coverHost = h("div", { class: "pw-cover-host" }, covered, overlay);
    const rm = btn("Remove overlay in 3 s", "act-overlay-remove", () => { rm.disabled = true; T.later(() => { overlay.remove(); say("Overlay removed"); }, 3000); });

    const moving = h("button", { class: "btn pw-moving", type: "button", "data-testid": "act-moving" }, "Moving button");
    moving.addEventListener("click", () => say("Moving button clicked"));
    const stop = btn("Stop / start animation", "act-moving-toggle", () => moving.classList.toggle("pw-moving"));

    const far = btn("Far away button", "act-offscreen", () => say("Off-screen button clicked"));
    const farBox = h("div", { class: "scroll-box", style: { height: "120px" }, "data-testid": "act-scroll-box" }, h("p", { class: "muted", text: "Scroll down inside this box…" }), h("div", { style: { height: "420px" } }), far);

    const ro = h("input", { type: "text", readonly: true, value: "locked", "data-testid": "act-readonly", "aria-label": "Read-only field" });
    const unlock = btn("Unlock in 2 s", "act-unlock", () => { unlock.disabled = true; T.later(() => { ro.removeAttribute("readonly"); ro.value = ""; unlock.disabled = false; say("Field is now editable"); }, 2000); });

    const reveal = btn("Hidden until hover", "act-reveal", () => say("Revealed button clicked"), "pw-reveal");
    const hostHover = h("div", { class: "pw-hover-host", "data-testid": "act-hover-host", tabindex: "0" }, h("span", { text: "Hover this card →" }), reveal);

    let n = 0;
    const mk = () => h("button", { class: "btn", type: "button", "data-testid": "act-rerender" }, "Re-render me" + (n ? ` (${n})` : ""));
    const rrHost = h("div", {});
    const wire = (b) => b.addEventListener("click", () => { n++; say("Re-render button clicked " + n + "x"); T.later(() => { const nb = mk(); wire(nb); rrHost.replaceChildren(nb); }, 300); });
    const first = mk(); wire(first); rrHost.append(first);

    const cb = h("input", { type: "checkbox", id: "act-cb", "data-testid": "act-check" });
    cb.addEventListener("change", () => say("Checkbox is " + (cb.checked ? "checked" : "unchecked")));

    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "1 · Enabled" }), h("div", { class: "row" }, dis, en)),
        stage(h("h2", { text: "2 · Receives events" }), coverHost, h("div", { style: { marginTop: "10px" } }, rm)),
        stage(h("h2", { text: "3 · Stable" }), h("div", { style: { overflow: "hidden" } }, moving), h("div", { style: { marginTop: "10px" } }, stop)),
        stage(h("h2", { text: "4 · Visible & in view" }), farBox),
        stage(h("h2", { text: "5 · Editable" }), field("Read-only field", ro), unlock),
        stage(h("h2", { text: "6 · Hover to reveal" }), hostHover),
        stage(h("h2", { text: "7 · Detached & re-attached" }), rrHost),
        stage(h("h2", { text: "8 · Checkbox" }), h("label", { class: "check", for: "act-cb" }, cb, "I agree to the terms"))),
      stage(h("h2", { text: "Action log" }), log),
      ref("auto-waiting", `import { test, expect } from "@playwright/test";

test("waits for enabled, unobstructed and stable", async ({ page }) => {
  await page.goto("/practice/playwright-actionability");
  await page.getByTestId("act-enable-start").click();
  await page.getByTestId("act-disabled").click();            // waits until enabled
  await page.getByTestId("act-overlay-remove").click();
  await page.getByTestId("act-covered").click();             // retries while the overlay intercepts pointer events
  await page.getByTestId("act-moving").click();              // waits for two identical bounding boxes
  await page.getByTestId("act-offscreen").click();           // scrolls into view first
  await page.getByTestId("act-hover-host").hover();
  await page.getByTestId("act-reveal").click({ trial: true }); // all checks, no click
  await page.getByTestId("act-reveal").click();
  await page.getByTestId("act-rerender").click();
  await page.getByTestId("act-rerender").click();
  await page.getByLabel("I agree to the terms").check();
  await expect(page.getByTestId("act-log")).toContainText("Submit order clicked");
});`));
    return T.clear;
  },
});

// ---------------------------------------------------------------- 2 assertions
page({
  id: "playwright-assertions", group: G, title: "Web-first assertions",
  blurb: "Values that change after a delay: practise retrying expect() matchers, polling and soft assertions.",
  tasks: [
    "Assert the status text becomes “Saved” with toHaveText (no waitForTimeout).",
    "Use toHaveCount(3) while items are added one per second, then toContainText on the list.",
    "Assert toHaveValue, toBeChecked, toBeEditable, toBeFocused, toHaveClass and toHaveCSS on the matching controls.",
    "Assert toHaveAttribute('aria-expanded', 'true') after opening the disclosure.",
    "Assert toHaveTitle and toHaveURL after the delayed title and URL changes.",
    "Use expect.poll() to wait for the counter to reach 10 and expect(...).toPass() to retry the flaky API block.",
    "Write four soft assertions against the product card so every mismatch is reported at once.",
    "Negate: assert the spinner is hidden with not.toBeVisible() and toBeHidden().",
  ],
  render(root) {
    const T = timersOf();
    const startTitle = document.title, startUrl = location.pathname;
    const status = h("p", { "data-testid": "as-status", role: "status", class: "mono" }, "Idle");
    const spin = h("span", { class: "spinner", hidden: true, "data-testid": "as-spinner", "aria-label": "Saving" });
    const save = btn("Save", "as-save", () => { status.textContent = "Saving…"; spin.hidden = false; T.later(() => { status.textContent = "Saved"; spin.hidden = true; }, 1500); }, "primary");

    const list = h("ul", { "data-testid": "as-list", "aria-label": "Items" });
    const add = btn("Add 3 items over 3 s", "as-add", () => { add.disabled = true; [1, 2, 3].forEach((i) => T.later(() => { list.append(h("li", { "data-testid": "as-item", text: "Item " + i })); if (i === 3) add.disabled = false; }, i * 1000)); });

    const val = h("input", { type: "text", value: "TestYard", "data-testid": "as-value", "aria-label": "Project name" });
    const chg = btn("Change value in 1 s", "as-change", () => T.later(() => { val.value = "Playwright"; }, 1000));

    const cb = h("input", { type: "checkbox", id: "as-cb", "data-testid": "as-checkbox" });
    const chk = btn("Tick the box in 1 s", "as-tick", () => T.later(() => { cb.checked = true; }, 1000));

    const panel = h("div", { id: "as-panel", hidden: true, "data-testid": "as-panel" }, "Disclosure content");
    const tog = h("button", { class: "btn", type: "button", "aria-expanded": "false", "aria-controls": "as-panel", "data-testid": "as-toggle" }, "Details");
    tog.addEventListener("click", () => { const open = tog.getAttribute("aria-expanded") === "true"; tog.setAttribute("aria-expanded", String(!open)); panel.hidden = open; });

    const box = h("div", { class: "pw-box", "data-testid": "as-box" }, "Status box");
    const act = btn("Activate in 1 s", "as-activate", () => T.later(() => box.classList.add("is-active"), 1000));

    const ed = h("input", { type: "text", readonly: true, "data-testid": "as-editable", "aria-label": "Editable later", value: "read-only" });
    const focusTarget = h("input", { type: "text", "data-testid": "as-focus-target", "aria-label": "Focus target" });
    const mix = btn("Edit & focus in 1 s", "as-edit-focus", () => T.later(() => { ed.removeAttribute("readonly"); focusTarget.focus(); }, 1000));

    const ttl = btn("Change title & URL in 1 s", "as-title", () => T.later(() => { document.title = "Playwright rocks | TestYard"; history.replaceState({}, "", "?step=2"); }, 1000));

    let c = 0; const counter = h("p", { "data-testid": "as-counter", class: "mono", text: "0" });
    const cnt = btn("Start counter", "as-counter-start", () => { cnt.disabled = true; c = 0; const iv = T.every(() => { counter.textContent = String(++c); if (c >= 10) { clearInterval(iv); cnt.disabled = false; } }, 400); });

    const flakyOut = h("div", { "data-testid": "as-flaky-out", role: "status" }, "—");
    const flaky = btn("Call flaky API (70% fail)", "as-flaky", async () => { const r = await api("GET", "/api/flaky?failRate=0.7", undefined, { auth: false }); flakyOut.replaceChildren(h("div", { class: "alert " + (r.ok ? "ok" : "bad"), text: r.ok ? "Flaky success" : "Flaky failure (HTTP " + r.status + ")" })); });

    const card = h("div", { class: "shop-card", "data-testid": "as-card" }, h("b", { "data-testid": "as-card-name", text: "Mechanical Keyboard" }), h("span", { "data-testid": "as-card-price", text: "$89.99" }), h("span", { "data-testid": "as-card-stock", text: "In stock: 14" }), h("span", { class: "tag ok", "data-testid": "as-card-badge", text: "Free shipping" }));

    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Text & visibility" }), status, h("div", { class: "row" }, save, spin)),
        stage(h("h2", { text: "Count" }), list, add),
        stage(h("h2", { text: "Value, checked, attribute" }), field("Project name", val), chg, h("div", { class: "row", style: { margin: "12px 0" } }, h("label", { class: "check", for: "as-cb" }, cb, "Accept"), chk), tog, panel),
        stage(h("h2", { text: "Class, CSS, editable, focus" }), box, act, h("div", { style: { marginTop: "12px" } }, field("Editable later", ed), field("Focus target", focusTarget), mix)),
        stage(h("h2", { text: "Title & URL" }), ttl, h("p", { class: "hint", text: "Changes document.title and adds ?step=2" })),
        stage(h("h2", { text: "Poll & toPass" }), counter, cnt, h("div", { style: { margin: "12px 0" } }, flaky), flakyOut),
        stage(h("h2", { text: "Soft assertions" }), card)),
      ref("expect cookbook", `import { test, expect } from "@playwright/test";

test("web-first assertions retry until they pass", async ({ page }) => {
  await page.goto("/practice/playwright-assertions");
  await page.getByTestId("as-save").click();
  await expect(page.getByTestId("as-status")).toHaveText("Saved");
  await expect(page.getByTestId("as-spinner")).toBeHidden();

  await page.getByTestId("as-add").click();
  await expect(page.getByTestId("as-item")).toHaveCount(3);

  await page.getByTestId("as-change").click();
  await expect(page.getByLabel("Project name")).toHaveValue("Playwright");

  await page.getByTestId("as-activate").click();
  await expect(page.getByTestId("as-box")).toHaveClass(/is-active/);
  await expect(page.getByTestId("as-box")).toHaveCSS("background-color", "rgb(29, 127, 85)");

  await page.getByTestId("as-toggle").click();
  await expect(page.getByTestId("as-toggle")).toHaveAttribute("aria-expanded", "true");

  await page.getByTestId("as-title").click();
  await expect(page).toHaveTitle(/Playwright rocks/);
  await expect(page).toHaveURL(/step=2/);

  await page.getByTestId("as-counter-start").click();
  await expect.poll(async () => Number(await page.getByTestId("as-counter").textContent())).toBeGreaterThanOrEqual(10);

  await expect(async () => {
    await page.getByTestId("as-flaky").click();
    await expect(page.getByTestId("as-flaky-out")).toContainText("success", { timeout: 1000 });
  }).toPass({ timeout: 15000 });

  const card = page.getByTestId("as-card");
  await expect.soft(card.getByTestId("as-card-name")).toHaveText("Mechanical Keyboard");
  await expect.soft(card.getByTestId("as-card-price")).toHaveText("$89.99");
  await expect.soft(card.getByTestId("as-card-stock")).toContainText("14");
  await expect.soft(card.getByTestId("as-card-badge")).toBeVisible();
});`));
    return () => { T.clear(); document.title = startTitle; if (location.pathname === startUrl) history.replaceState({}, "", startUrl); };
  },
});

// ---------------------------------------------------------------- 3 network
page({
  id: "playwright-network", group: "playwright", title: "Network mocking",
  blurb: "A UI that calls real API endpoints and logs every request: mock, block, delay and wait for them.",
  tasks: [
    "Use page.route('**/api/products*') with route.fulfill() to show exactly two fake products.",
    "Fulfil /api/users with an empty list and assert the empty-state message.",
    "Abort the advertisement image with route.abort() and assert it did not load.",
    "Use page.waitForResponse() to wait for /api/products while clicking the button, then assert response.status().",
    "Mock /api/flaky with 503 and assert the error alert; then use route.fallback() / route.continue() to pass real calls through.",
    "Modify a real response: fetch it with route.fetch(), change a price and fulfil with the patched JSON.",
    "Run the type-ahead search and find the stale-response race: how do you assert only the latest results are shown?",
    "Listen to page.on('request') and page.on('response') and compare with the on-page request log.",
  ],
  render(root) {
    let seq = 0;
    const logBody = h("tbody", { "data-testid": "net-request-log-body" });
    const call = async (method, path, body, opts) => {
      const n = ++seq; const row = h("tr", { "data-testid": "net-request-row" }, h("td", { text: String(n) }), h("td", { text: method }), h("td", { class: "mono", text: path }), h("td", { text: "…" }), h("td", { text: "" }));
      logBody.prepend(row); while (logBody.children.length > 12) logBody.lastChild.remove();
      const r = await api(method, path, body, opts);
      row.children[3].textContent = r.status ? String(r.status) : "failed"; row.children[4].textContent = r.ms + " ms";
      return r;
    };
    const errBox = h("div", { "data-testid": "net-error", role: "alert" });
    const showErr = (r) => errBox.replaceChildren(r.ok ? "" : h("div", { class: "alert bad", text: `Request failed: HTTP ${r.status || "network error"}` }));
    const list = h("ul", { "data-testid": "net-products", "aria-label": "Products" });
    const loadP = btn("Load products", "net-load-products", async () => { const r = await call("GET", "/api/products?limit=5"); showErr(r); if (!r.ok) return; const items = r.data?.data?.items ?? r.data?.data ?? []; list.replaceChildren(...(items.length ? items : []).map((p) => h("li", { "data-testid": "net-product-row", text: `${p.name} — $${Number(p.price).toFixed(2)}` })), ...(items.length ? [] : [h("li", { "data-testid": "net-empty", text: "No products" })])); }, "primary");
    const users = h("ul", { "data-testid": "net-users", "aria-label": "Users" });
    const loadU = btn("Load users", "net-load-users", async () => { const r = await call("GET", "/api/users?per_page=5"); showErr(r); if (!r.ok) return; const items = r.data?.data ?? []; users.replaceChildren(...(items.length ? items.map((u) => h("li", { "data-testid": "net-user-row", text: `${u.name} (${u.job})` })) : [h("li", { "data-testid": "net-users-empty", text: "No users found" })])); });
    const flaky = btn("Call flaky API", "net-flaky", async () => { const r = await call("GET", "/api/flaky?failRate=0.5", undefined, { auth: false }); flakyOut.replaceChildren(h("div", { class: "alert " + (r.ok ? "ok" : "bad"), role: "status", text: `HTTP ${r.status}` })); });
    const flakyOut = h("div", { "data-testid": "net-flaky-out" });
    const spin = h("span", { class: "spinner", hidden: true, "data-testid": "net-spinner" });
    const slowOut = h("p", { class: "mono", "data-testid": "net-slow-out", text: "—" });
    const slow = btn("Slow call (2 s)", "net-slow", async () => { spin.hidden = false; const r = await call("GET", "/api/delay/2000", undefined, { auth: false }); spin.hidden = true; slowOut.textContent = `HTTP ${r.status} in ${r.ms} ms`; });
    const code = h("select", { "data-testid": "net-status-code", "aria-label": "Status code", style: { width: "auto" } }, [200, 400, 401, 403, 404, 500, 503].map((c) => h("option", { value: c, text: c })));
    const statusOut = h("p", { class: "mono", "data-testid": "net-status-out", text: "—" });
    const sendCode = btn("Call /api/status", "net-status-send", async () => { const r = await call("GET", "/api/status/" + code.value, undefined, { auth: false, redirect: "manual" }); statusOut.textContent = "HTTP " + r.status; });
    const echoOut = out("net-echo-out");
    const post = btn("POST /api/echo", "net-echo", async () => { const r = await call("POST", "/api/echo", { item: "keyboard", qty: 2 }, { auth: false }); echoOut.textContent = pretty(r.data?.data?.body ?? r.data); });
    const banner = h("img", { alt: "Advertisement", "data-testid": "net-banner", width: 320, height: 90, src: "/api/slow-image?ms=300&label=Advertisement" });
    const bannerState = h("p", { class: "mono", "data-testid": "net-banner-state", text: "loading" });
    banner.addEventListener("load", () => (bannerState.textContent = "loaded")); banner.addEventListener("error", () => (bannerState.textContent = "blocked or failed"));

    const search = h("input", { type: "search", "data-testid": "net-search", "aria-label": "Search tools", placeholder: "Type: pl, play, playwright" });
    const results = h("ul", { "data-testid": "net-search-results", "aria-label": "Search results" });
    const resTitle = h("p", { class: "mono", "data-testid": "net-search-query", text: "Showing: nothing yet" });
    const guard = h("input", { type: "checkbox", id: "net-ignore-stale", "data-testid": "net-ignore-stale" });
    let latest = 0;
    search.addEventListener("input", async () => {
      const q = search.value.trim(); if (!q) return; const mine = ++latest;
      const r = await call("GET", "/api/search?q=" + encodeURIComponent(q), undefined, { auth: false });
      if (guard.checked && mine !== latest) return;
      resTitle.textContent = "Showing: " + (r.data?.data?.q ?? q);
      results.replaceChildren(...(r.data?.data?.results ?? []).map((x) => h("li", { "data-testid": "net-search-item", text: x })));
    });

    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Products" }), loadP, h("div", { style: { marginTop: "10px" } }, errBox, list)),
        stage(h("h2", { text: "Users" }), loadU, h("div", { style: { marginTop: "10px" } }, users)),
        stage(h("h2", { text: "Flaky & slow" }), h("div", { class: "row" }, flaky, slow, spin), flakyOut, slowOut),
        stage(h("h2", { text: "Status & POST" }), h("div", { class: "row" }, code, sendCode, post), statusOut, echoOut),
        stage(h("h2", { text: "Blockable image" }), banner, bannerState),
        stage(h("h2", { text: "Type-ahead race" }), field("Search tools", search), h("label", { class: "check", for: "net-ignore-stale" }, guard, "Ignore stale responses"), resTitle, results)),
      stage(h("h2", { text: "Request log (what the UI sent)" }), h("div", { class: "tbl-wrap" }, h("table", { "data-testid": "net-request-log" }, h("thead", {}, h("tr", {}, ["#", "Method", "URL", "Status", "Time"].map((t) => h("th", { text: t })))), logBody))),
      ref("mock, block, wait, patch", `import { test, expect } from "@playwright/test";

test("mock the products API", async ({ page }) => {
  await page.route("**/api/products*", (route) => route.fulfill({
    json: { success: true, data: { items: [{ name: "Fake A", price: 1 }, { name: "Fake B", price: 2 }] } },
  }));
  await page.goto("/practice/playwright-network");
  await page.getByTestId("net-load-products").click();
  await expect(page.getByTestId("net-product-row")).toHaveCount(2);
});

test("block the ad image and force an error", async ({ page }) => {
  await page.route("**/api/slow-image*", (route) => route.abort());
  await page.route("**/api/flaky*", (route) => route.fulfill({ status: 503, json: { success: false } }));
  await page.goto("/practice/playwright-network");
  await expect(page.getByTestId("net-banner-state")).toHaveText("blocked or failed");
  await page.getByTestId("net-flaky").click();
  await expect(page.getByTestId("net-flaky-out")).toContainText("503");
});

test("patch a real response and wait for it", async ({ page }) => {
  await page.route("**/api/products*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.items[0].name = "PATCHED";
    await route.fulfill({ response, json: body });
  });
  await page.goto("/practice/playwright-network");
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/products") && r.status() === 200),
    page.getByTestId("net-load-products").click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(page.getByTestId("net-product-row").first()).toContainText("PATCHED");
});`));
  },
});

// ---------------------------------------------------------------- 4 API testing
page({
  id: "playwright-api-testing", group: G, title: "API testing with request",
  blurb: "Mix the request fixture and the UI: create data over HTTP, then verify it in the browser.",
  tasks: [
    "Read the sandbox id shown on the page (or localStorage 'ty.sandbox') and send it as the X-Sandbox header.",
    "POST /api/users with request.post(), reload the page and assert the new user appears in the table.",
    "Create a user in the UI form and verify it with request.get('/api/users/:id').",
    "Delete the user with the row button and assert request.get() now returns 404.",
    "Validate the 400 error body (errors array) when name is empty.",
    "Use request.newContext({ baseURL, extraHTTPHeaders }) for a standalone API client in a fixture.",
    "Chain calls: create → patch → get → delete, asserting status codes 201, 200, 200, 204.",
  ],
  render(root) {
    const sb = sandboxId();
    const body = h("tbody", { "data-testid": "ap-users-body" });
    const msg = h("div", { "data-testid": "ap-msg", role: "status" });
    const draw = async () => {
      const r = await api("GET", "/api/users?per_page=50", undefined, { auth: false });
      const rows = (r.data?.data ?? []).slice(-8).reverse();
      body.replaceChildren(...rows.map((u) => h("tr", { "data-testid": "ap-user-row", "data-user-id": u.id },
        h("td", { text: String(u.id) }), h("td", { "data-col": "name", text: u.name }), h("td", { "data-col": "job", text: u.job }),
        h("td", {}, h("button", { class: "btn sm danger", type: "button", "data-testid": "ap-delete-" + u.id, "aria-label": "Delete " + u.name, onClick: async () => { const d = await api("DELETE", "/api/users/" + u.id, undefined, { auth: false }); msg.replaceChildren(h("div", { class: "alert " + (d.status === 204 ? "ok" : "bad"), text: "DELETE → " + d.status })); draw(); } }, "Delete")))));
    };
    const name = h("input", { type: "text", "data-testid": "ap-name", maxlength: "60" }), job = h("input", { type: "text", "data-testid": "ap-job", maxlength: "60" });
    const lastId = h("code", { "data-testid": "ap-last-id", text: "—" });
    const create = btn("Create user", "ap-create", async () => {
      const r = await api("POST", "/api/users", { name: name.value, job: job.value }, { auth: false });
      msg.replaceChildren(h("div", { class: "alert " + (r.ok ? "ok" : "bad") }, `POST → ${r.status}`, r.ok ? "" : " " + (r.data?.errors ?? []).map((e) => e.message || e).join(", ")));
      if (r.ok) { lastId.textContent = String(r.data.data.id); name.value = ""; job.value = ""; draw(); }
    }, "primary");
    root.append(
      stage(h("p", {}, "Your sandbox id: ", h("code", { "data-testid": "ap-sandbox", text: sb }), h("span", { class: "hint", text: "  (send it as the X-Sandbox header to share data between request and UI)" }))),
      h("div", { class: "grid g2", style: { alignItems: "start", marginTop: "18px" } },
        stage(h("h2", { text: "Create a user" }), field("Name", name), field("Job", job), h("div", { class: "row" }, create, h("span", { class: "muted" }, "Last id: ", lastId)), h("div", { style: { marginTop: "10px" } }, msg)),
        stage(h("h2", { text: "Latest users" }), h("div", { class: "tbl-wrap" }, h("table", { "data-testid": "ap-users" }, h("thead", {}, h("tr", {}, ["ID", "Name", "Job", ""].map((t) => h("th", { text: t })))), body)))),
      ref("API + UI together", `import { test, expect, request as pwRequest } from "@playwright/test";

test("seed over HTTP, verify in the browser", async ({ page, request }) => {
  await page.goto("/practice/playwright-api-testing");
  const sandbox = await page.getByTestId("ap-sandbox").textContent();
  const created = await request.post("/api/users", {
    headers: { "X-Sandbox": sandbox },
    data: { name: "Nina API", job: "SDET" },
  });
  expect(created.status()).toBe(201);
  const { data } = await created.json();

  await page.reload();
  await expect(page.getByTestId("ap-user-row").filter({ hasText: "Nina API" })).toBeVisible();

  await page.getByTestId("ap-delete-" + data.id).click();
  const gone = await request.get("/api/users/" + data.id, { headers: { "X-Sandbox": sandbox } });
  expect(gone.status()).toBe(404);
});

test("validation errors from the API", async ({ request }) => {
  const res = await request.post("/api/users", { data: { name: "", job: "" } });
  expect(res.status()).toBe(400);
  expect((await res.json()).errors.length).toBeGreaterThan(0);
});

test("standalone API client", async ({ baseURL }) => {
  const api = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { "X-Sandbox": "api-suite" } });
  expect((await api.get("/api/health")).ok()).toBeTruthy();
  await api.dispose();
});`));
    draw();
  },
});

// ---------------------------------------------------------------- 5 auth & storage state
page({
  id: "playwright-auth-storage", group: G, title: "Auth & storage state",
  blurb: "Log in once, save storageState and reuse it. Tokens in localStorage, role cookies and expiring sessions.",
  tasks: [
    "Log in through the UI with practice@testyard.dev / SecretPass1! and save context.storageState({ path }).",
    "Create a second context with storageState and assert you land logged in without touching the form.",
    "Skip the UI: call request.post('/api/auth/login') and inject ty.token and ty.user with addInitScript or storageState origins.",
    "Switch the role to admin and assert the admin panel appears only for admin + logged-in users.",
    "Read cookies with context.cookies() and add the ty_role cookie with context.addCookies().",
    "Press “Expire session in 3 s” and assert the app logs the user out (toHaveText on the status).",
    "Build an auth.setup.ts project dependency that writes .auth/user.json for every other project.",
  ],
  render(root) {
    const T = timersOf();
    const email = h("input", { type: "email", value: "", "data-testid": "au-email", autocomplete: "off" }), pw = h("input", { type: "password", "data-testid": "au-password", autocomplete: "off" });
    const err = h("div", { "data-testid": "au-error", role: "alert" });
    const status = h("p", { "data-testid": "au-status", role: "status", class: "mono" });
    const state = h("pre", { "data-testid": "au-state" });
    const adminPanel = h("div", { class: "alert info", "data-testid": "au-admin-panel", hidden: true }, "Admin panel: manage every user");
    const role = h("select", { "data-testid": "au-role", "aria-label": "Role" }, ["viewer", "editor", "admin"].map((r) => h("option", { value: r, text: r })));
    role.value = store.get("pwRole", "viewer");
    const profile = h("div", { "data-testid": "au-profile" });
    const cookieMap = () => Object.fromEntries(document.cookie.split("; ").filter(Boolean).map((c) => c.split("=").map(decodeURIComponent)));
    const refresh = () => {
      const u = auth.user, logged = !!auth.token;
      status.textContent = logged ? "Logged in as " + u?.email : "Logged out";
      profile.replaceChildren(...(logged ? [h("p", {}, "Welcome, ", h("b", { "data-testid": "au-profile-name", text: u?.name || "" })), btn("Log out", "au-logout", () => auth.clear())] : [h("p", { class: "muted", text: "Not signed in." })]));
      adminPanel.hidden = !(logged && role.value === "admin");
      state.textContent = pretty({ cookies: cookieMap(), localStorage: { "ty.token": auth.token ? auth.token.slice(0, 8) + "…" : null, "ty.user": u }, role: role.value });
    };
    const login = btn("Log in", "au-login", async () => {
      err.replaceChildren(); const r = await api("POST", "/api/auth/login", { email: email.value, password: pw.value }, { auth: false });
      if (r.ok) auth.set(r.data.data.token, { id: r.data.data.id, name: r.data.data.name, email: r.data.data.email });
      else err.replaceChildren(h("div", { class: "alert bad", text: r.data?.message || "Login failed" }));
    }, "primary");
    const fillDemo = btn("Fill demo credentials", "au-fill-demo", () => { email.value = "practice@testyard.dev"; pw.value = "SecretPass1!"; });
    const expire = btn("Expire session in 3 s", "au-expire", () => { T.later(() => { auth.clear(); status.textContent = "Session expired, please log in again"; }, 3000); });
    role.addEventListener("change", () => { store.set("pwRole", role.value); document.cookie = `ty_role=${role.value}; path=/; max-age=3600; SameSite=Lax`; refresh(); });
    window.addEventListener("ty-auth", refresh);
    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Sign in" }), field("Email", email), field("Password", pw), h("div", { class: "row" }, login, fillDemo), h("div", { style: { margin: "10px 0" } }, err), status),
        stage(h("h2", { text: "Session" }), profile, h("div", { style: { margin: "14px 0" } }, field("Role (stored as cookie ty_role + localStorage)", role)), adminPanel, h("div", { class: "row", style: { marginTop: "12px" } }, expire)),
        stage(h("h2", { text: "Browser state" }), state)),
      ref("storageState + API login", `// tests/auth.setup.ts
import { test as setup, expect } from "@playwright/test";
export const authFile = ".auth/user.json";

setup("sign in once", async ({ page }) => {
  await page.goto("/practice/playwright-auth-storage");
  await page.getByTestId("au-fill-demo").click();
  await page.getByTestId("au-login").click();
  await expect(page.getByTestId("au-status")).toContainText("Logged in as practice@testyard.dev");
  await page.context().storageState({ path: authFile });
});

// playwright.config.ts (excerpt)
// projects: [
//   { name: "setup", testMatch: /auth.setup.ts/ },
//   { name: "chromium", use: { storageState: ".auth/user.json" }, dependencies: ["setup"] },
// ]

// tests/session.spec.ts
import { test, expect } from "@playwright/test";

test("starts logged in via storageState", async ({ page }) => {
  await page.goto("/practice/playwright-auth-storage");
  await expect(page.getByTestId("au-profile-name")).toHaveText("Practice User");
});

test("log in over the API and inject the session", async ({ page, request }) => {
  const res = await request.post("/api/auth/login", { data: { email: "practice@testyard.dev", password: "SecretPass1!" } });
  const { data } = await res.json();
  await page.addInitScript(([t, u]) => {
    localStorage.setItem("ty.token", JSON.stringify(t));
    localStorage.setItem("ty.user", JSON.stringify(u));
  }, [data.token, { id: data.id, name: data.name, email: data.email }]);
  await page.goto("/practice/playwright-auth-storage");
  await expect(page.getByTestId("au-status")).toContainText("practice@testyard.dev");
});

test("role cookie unlocks the admin panel", async ({ page, context }) => {
  await context.addCookies([{ name: "ty_role", value: "admin", url: "http://localhost:3000" }]);
  await page.goto("/practice/playwright-auth-storage");
  await page.getByTestId("au-role").selectOption("admin");
  expect((await context.cookies()).some((c) => c.name === "ty_role" && c.value === "admin")).toBeTruthy();
});`));
    refresh();
    return () => { T.clear(); window.removeEventListener("ty-auth", refresh); };
  },
});

// ---------------------------------------------------------------- 6 popups & multiple tabs
page({
  id: "playwright-multi-context", group: G, title: "Popups & multiple tabs",
  blurb: "window.open popups, target=_blank tabs and a two-tab chat that talks over BroadcastChannel.",
  tasks: [
    "Use page.waitForEvent('popup') around the Open popup button and assert the popup's heading.",
    "Use context.waitForEvent('page') for the target=_blank link; call newPage.waitForLoadState().",
    "Open the page twice in the SAME context, send a chat message from page A and assert it arrives in page B.",
    "Open it in two DIFFERENT contexts and prove the messages do NOT cross (isolation).",
    "Close the popup and bring the original page back with page.bringToFront().",
    "Assert the “tabs online” counter reaches 2 when both pages are open.",
    "Handle window.opener: assert the popup opened by script has an opener and the noopener link does not.",
  ],
  render(root) {
    const me = (() => { try { let n = sessionStorage.getItem("ty.pwTab"); if (!n) { n = "Tab-" + Math.random().toString(36).slice(2, 6); sessionStorage.setItem("ty.pwTab", n); } return n; } catch { return "Tab-" + rand(1000, 9999); } })();
    const popStatus = h("p", { class: "mono", "data-testid": "mc-popup-status", text: "No popup yet" });
    const open = btn("Open popup window", "mc-open-popup", () => { const w = window.open("/practice/window-child", "ty-pw-popup", "popup,width=520,height=420"); popStatus.textContent = w ? "Popup opened (opener is set)" : "Popup blocked"; }, "primary");
    const msgs = h("ul", { "data-testid": "mc-messages", "aria-label": "Chat messages", style: { paddingLeft: "18px", minHeight: "80px" } });
    const online = h("span", { class: "tag acc", "data-testid": "mc-online", text: "1" });
    const input = h("input", { type: "text", "data-testid": "mc-chat-input", "aria-label": "Message", placeholder: "Say hi to the other tab" });
    let ch = null; const peers = new Map();
    const addMsg = (who, text) => msgs.append(h("li", { "data-testid": "mc-message", text: `${who}: ${text}` }));
    const count = () => { const now = Date.now(); for (const [k, t] of peers) if (now - t > 4500) peers.delete(k); online.textContent = String(peers.size + 1); };
    const T = timersOf();
    try {
      ch = new BroadcastChannel("ty-pw-chat");
      ch.onmessage = (e) => { const m = e.data; if (!m || typeof m !== "object") return; if (m.type === "msg") addMsg(String(m.from).slice(0, 20), String(m.text).slice(0, 200)); if (m.type === "beat" && m.from !== me) { peers.set(m.from, Date.now()); count(); } };
      const beat = () => ch.postMessage({ type: "beat", from: me });
      beat(); T.every(() => { beat(); count(); }, 1500);
    } catch { addMsg("system", "BroadcastChannel is not available in this browser"); }
    const send = btn("Send", "mc-chat-send", () => { const t = input.value.trim(); if (!t) return; addMsg("me", t); ch?.postMessage({ type: "msg", from: me, text: t }); input.value = ""; }, "primary");
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") send.click(); });
    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Popups & tabs" }), h("div", { class: "row" }, open, h("a", { class: "btn", href: "/practice/window-child", target: "_blank", rel: "noopener", "data-testid": "mc-new-tab" }, "Open in new tab"), h("a", { class: "btn", href: "/practice/window-child", target: "_blank", "data-testid": "mc-new-tab-opener" }, "New tab (keeps opener)")), h("div", { style: { marginTop: "12px" } }, popStatus)),
        stage(h("h2", { text: "Two-tab chat" }), h("p", {}, "You are ", h("b", { "data-testid": "mc-me", text: me }), " · tabs online: ", online), field("Message", input), send, h("div", { style: { marginTop: "12px" } }, msgs))),
      ref("popup, new page, two pages", `import { test, expect } from "@playwright/test";

test("popup and new tab", async ({ page, context }) => {
  await page.goto("/practice/playwright-multi-context");
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("mc-open-popup").click()]);
  await popup.waitForLoadState();
  await expect(popup.getByRole("heading", { level: 1 })).toBeVisible();
  await popup.close();
  await page.bringToFront();

  const [tab] = await Promise.all([context.waitForEvent("page"), page.getByTestId("mc-new-tab").click()]);
  await expect(tab).toHaveURL(/window-child/);
});

test("two pages in one context share a BroadcastChannel", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/practice/playwright-multi-context");
  await b.goto("/practice/playwright-multi-context");
  await expect(a.getByTestId("mc-online")).toHaveText("2");
  await a.getByTestId("mc-chat-input").fill("hello from A");
  await a.getByTestId("mc-chat-send").click();
  await expect(b.getByTestId("mc-message")).toContainText("hello from A");
});

test("different contexts are isolated", async ({ browser }) => {
  const c1 = await browser.newContext(), c2 = await browser.newContext();
  const a = await c1.newPage(), b = await c2.newPage();
  await a.goto("/practice/playwright-multi-context");
  await b.goto("/practice/playwright-multi-context");
  await a.getByTestId("mc-chat-input").fill("private");
  await a.getByTestId("mc-chat-send").click();
  await expect(b.getByTestId("mc-message")).toHaveCount(0);
  await c1.close(); await c2.close();
});`));
    return () => { T.clear(); ch?.close(); };
  },
});

// ---------------------------------------------------------------- 7 frames & shadow
page({
  id: "playwright-frames-shadow", group: G, title: "Frames & shadow piercing",
  blurb: "A payment iframe, a late-loading frame, nested frames and open/closed shadow roots.",
  tasks: [
    "Fill the card form with page.frameLocator('[data-testid=fs-payment-frame]') and click Pay.",
    "Assert the parent page received the postMessage (“Payment received”).",
    "Wait for the lazy frame (appears after 2 s) with frameLocator and toBeVisible.",
    "Reach the button two frames deep using chained frameLocator() calls.",
    "Locate the nickname input inside the open shadow root with plain CSS or getByLabel (Playwright pierces open roots).",
    "Explain why the closed shadow root button cannot be located, and how to test it another way.",
    "List all frames with page.frames() and find one by name with page.frame({ name }).",
  ],
  render(root) {
    const T = timersOf();
    const paid = h("p", { class: "alert info", role: "status", "data-testid": "fs-paid-msg" }, "Waiting for payment");
    const style = "<style>body{font:14px system-ui;margin:10px}label{display:block;margin:6px 0 2px}input{padding:6px;width:90%}button{margin-top:10px;padding:7px 14px}</style>";
    const pay = h("iframe", { title: "Payment frame", name: "payment-frame", "data-testid": "fs-payment-frame", style: { width: "100%", height: "190px", border: "1px solid var(--line)", borderRadius: "10px", background: "#fff" },
      srcdoc: `${style}<h3>Secure payment</h3><label for="card">Card number</label><input id="card" inputmode="numeric" autocomplete="off"><label for="exp">Expiry</label><input id="exp" placeholder="MM/YY" autocomplete="off"><button id="pay" type="button">Pay now</button>` });
    pay.addEventListener("load", () => { const d = pay.contentDocument; d?.getElementById("pay").addEventListener("click", () => { const card = d.getElementById("card").value.replace(/\s/g, ""); paid.textContent = card.length >= 12 ? "Payment received: card ending " + card.slice(-4) : "Payment declined: invalid card"; }); });
    const lazyHost = h("div", { "data-testid": "fs-lazy-host", style: { minHeight: "70px" } }, h("span", { class: "spinner", "aria-label": "Loading frame" }));
    T.later(() => { const f = h("iframe", { title: "Lazy frame", name: "lazy-frame", "data-testid": "fs-lazy-frame", style: { width: "100%", height: "70px", border: "1px solid var(--line)", borderRadius: "10px", background: "#fff" }, srcdoc: `${style}<p id="lazy-text">Lazy frame content is ready</p>` }); lazyHost.replaceChildren(f); }, 2000);
    const inner = `${style}<button id="deep-btn" type="button">Deep button</button><p id="deep-out">Not clicked</p>`;
    const outer = h("iframe", { title: "Outer frame", name: "outer-frame", "data-testid": "fs-outer-frame", style: { width: "100%", height: "220px", border: "1px solid var(--line)", borderRadius: "10px", background: "#fff" }, srcdoc: `${style}<h3>Outer frame</h3><iframe title="Inner frame" name="inner-frame" style="width:95%;height:120px" srcdoc="${inner.replace(/"/g, "&quot;")}"></iframe>` });
    outer.addEventListener("load", () => { const i = outer.contentDocument?.querySelector("iframe"); const bind = () => { const d = i?.contentDocument; d?.getElementById("deep-btn")?.addEventListener("click", () => { d.getElementById("deep-out").textContent = "Deep click received"; }); }; i?.addEventListener("load", bind); bind(); });

    if (typeof customElements !== "undefined" && !customElements.get("pw-profile-card")) {
      customElements.define("pw-profile-card", class extends HTMLElement {
        connectedCallback() {
          if (this.shadowRoot) return;
          const r = this.attachShadow({ mode: "open" });
          r.innerHTML = `<style>.c{border:1px solid #999;border-radius:10px;padding:12px;font:14px system-ui;background:#fff;color:#111}input{padding:6px}button{padding:6px 12px}</style><div class="c"><h4 style="margin:0 0 8px">Profile card</h4><label for="nick">Nickname</label> <input id="nick"> <button type="button" id="save">Save nickname</button><p id="out" role="status" style="margin:8px 0 0">Saved: none</p><slot></slot></div>`;
          r.getElementById("save").addEventListener("click", () => { r.getElementById("out").textContent = "Saved: " + r.getElementById("nick").value; });
        }
      });
      customElements.define("pw-vault", class extends HTMLElement {
        connectedCallback() {
          if (this.__r) return;
          this.__r = this.attachShadow({ mode: "closed" });
          this.__r.innerHTML = `<button type="button" id="vault-btn" style="padding:8px 12px">Closed vault button</button>`;
          this.__r.getElementById("vault-btn").addEventListener("click", () => { this.setAttribute("data-opened", "true"); });
        }
      });
    }
    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Payment iframe" }), pay, h("div", { style: { marginTop: "10px" } }, paid)),
        stage(h("h2", { text: "Frame that appears late" }), lazyHost),
        stage(h("h2", { text: "Nested frames" }), outer),
        stage(h("h2", { text: "Open & closed shadow roots" }), h("pw-profile-card", { "data-testid": "fs-shadow-host" }, h("small", { text: "slotted light-DOM text" })), h("div", { style: { marginTop: "14px" } }, h("pw-vault", { "data-testid": "fs-vault-host" })))),
      ref("frameLocator + shadow", `import { test, expect } from "@playwright/test";

test("payment iframe and postMessage-style result", async ({ page }) => {
  await page.goto("/practice/playwright-frames-shadow");
  const pay = page.frameLocator("[data-testid=fs-payment-frame]");
  await pay.getByLabel("Card number").fill("4242 4242 4242 4242");
  await pay.getByLabel("Expiry").fill("12/30");
  await pay.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByTestId("fs-paid-msg")).toContainText("card ending 4242");
});

test("lazy and nested frames", async ({ page }) => {
  await page.goto("/practice/playwright-frames-shadow");
  await expect(page.frameLocator("[data-testid=fs-lazy-frame]").locator("#lazy-text")).toBeVisible();
  const deep = page.frameLocator("[data-testid=fs-outer-frame]").frameLocator("iframe[name=inner-frame]");
  await deep.getByRole("button", { name: "Deep button" }).click();
  await expect(deep.locator("#deep-out")).toHaveText("Deep click received");
  expect(page.frame({ name: "payment-frame" })).not.toBeNull();
});

test("open shadow root is pierced automatically", async ({ page }) => {
  await page.goto("/practice/playwright-frames-shadow");
  await page.getByLabel("Nickname").fill("sdet-nina");
  await page.getByRole("button", { name: "Save nickname" }).click();
  await expect(page.locator("pw-profile-card").getByRole("status")).toHaveText("Saved: sdet-nina");
  // The closed root is invisible to locators: assert the host instead.
  await expect(page.getByTestId("fs-vault-host")).toBeVisible();
});`));
    return T.clear;
  },
});

// ---------------------------------------------------------------- 8 dialogs, downloads, uploads
page({
  id: "playwright-files-dialogs", group: G, title: "Dialogs, downloads, uploads",
  blurb: "JS dialogs, beforeunload, real downloads and every flavour of file upload, including file choosers.",
  tasks: [
    "Register page.once('dialog') before clicking: accept the confirm, dismiss it, then answer the prompt with text.",
    "Assert dialog.type(), dialog.message() and dialog.defaultValue() for alert, confirm and prompt.",
    "Enable the leave warning and handle the beforeunload dialog when you navigate away (page.close({ runBeforeUnload: true })).",
    "Wait for page.waitForEvent('download') on the CSV link; assert suggestedFilename() and read the file with download.path().",
    "Download the generated report and parse its content.",
    "Upload one file, several files, a Buffer payload (name, mimeType, buffer) and clear the selection with setInputFiles([]).",
    "Use page.waitForEvent('filechooser') with the custom “Choose files” button.",
    "Send the files to the API and assert the response lists names and sizes.",
  ],
  render(root) {
    const dOut = h("p", { class: "mono", "data-testid": "dg-out", role: "status", text: "—" });
    const alertB = btn("Alert", "dg-alert", () => { window.alert("Heads up!"); dOut.textContent = "Alert closed"; });
    const confirmB = btn("Confirm", "dg-confirm", () => { dOut.textContent = window.confirm("Delete this item?") ? "You pressed OK" : "You pressed Cancel"; });
    const promptB = btn("Prompt", "dg-prompt", () => { const v = window.prompt("What is your name?", "Guest"); dOut.textContent = v === null ? "Prompt cancelled" : "Hello, " + v; });
    const warn = h("input", { type: "checkbox", id: "dg-leave", "data-testid": "dg-leave-toggle" });
    const guard = (e) => { e.preventDefault(); e.returnValue = ""; };
    warn.addEventListener("change", () => { warn.checked ? window.addEventListener("beforeunload", guard) : window.removeEventListener("beforeunload", guard); });

    const dlStatus = h("p", { class: "mono", "data-testid": "dl-status", text: "No download yet" });
    const csv = h("a", { class: "btn", href: "/api/files/sample.csv", download: "sample.csv", "data-testid": "dl-csv", onClick: () => (dlStatus.textContent = "Download started: sample.csv") }, "Download sample.csv");
    const gen = btn("Generate report.txt", "dl-generate", () => {
      const blob = new Blob(["TestYard report\nrows,3\nstatus,PASS\n"], { type: "text/plain" }); const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: "report.txt" }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      dlStatus.textContent = "Download started: report.txt";
    });

    const list = h("ul", { "data-testid": "up-list", "aria-label": "Selected files" });
    const apiOut = out("up-result");
    let files = [];
    const show = (fs) => { files = [...fs]; list.replaceChildren(...(files.length ? files.map((f) => h("li", { "data-testid": "up-file", text: `${f.webkitRelativePath || f.name} (${f.size} bytes)` })) : [h("li", { "data-testid": "up-empty", text: "No files selected" })])); };
    const input = h("input", { type: "file", id: "up-input", multiple: true, "data-testid": "up-input" });
    input.addEventListener("change", () => show(input.files));
    const dir = h("input", { type: "file", id: "up-dir", webkitdirectory: true, "data-testid": "up-dir" });
    dir.addEventListener("change", () => show(dir.files));
    const hidden = h("input", { type: "file", multiple: true, class: "sr", tabindex: "-1", "aria-hidden": "true", "data-testid": "up-hidden-input" });
    hidden.addEventListener("change", () => show(hidden.files));
    const chooser = btn("Choose files…", "up-chooser", () => hidden.click(), "primary");
    const zone = h("div", { class: "dropzone", "data-testid": "up-dropzone", role: "button", tabindex: "0", "aria-label": "Drop files here" }, "Drop files here");
    ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("over"); }));
    zone.addEventListener("drop", (e) => show(e.dataTransfer.files));
    const send = btn("Send to API", "up-send", async () => {
      if (!files.length) { apiOut.textContent = "Select at least one file first"; return; }
      const fd = new FormData(); files.slice(0, 5).forEach((f) => fd.append("files", f, f.name));
      const r = await api("POST", "/api/upload", fd, { auth: false }); apiOut.textContent = `HTTP ${r.status}\n` + pretty(r.data);
    });
    show([]);
    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "JS dialogs" }), h("div", { class: "row" }, alertB, confirmB, promptB), h("div", { style: { margin: "12px 0" } }, dOut), h("label", { class: "check", for: "dg-leave" }, warn, "Warn before leaving this page")),
        stage(h("h2", { text: "Downloads" }), h("div", { class: "row" }, csv, gen), h("div", { style: { marginTop: "10px" } }, dlStatus)),
        stage(h("h2", { text: "Uploads" }), field("Choose files", input), field("Choose a folder", dir), h("div", { class: "row" }, chooser, hidden), h("div", { style: { margin: "12px 0" } }, zone), list, h("div", { class: "row", style: { margin: "12px 0" } }, send), apiOut)),
      ref("dialogs, downloads, uploads", `import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("dialogs", async ({ page }) => {
  await page.goto("/practice/playwright-files-dialogs");
  page.once("dialog", (d) => { expect(d.type()).toBe("confirm"); d.accept(); });
  await page.getByTestId("dg-confirm").click();
  await expect(page.getByTestId("dg-out")).toHaveText("You pressed OK");
  page.once("dialog", (d) => d.accept("Nina"));
  await page.getByTestId("dg-prompt").click();
  await expect(page.getByTestId("dg-out")).toHaveText("Hello, Nina");
});

test("downloads", async ({ page }) => {
  await page.goto("/practice/playwright-files-dialogs");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("dl-csv").click()]);
  expect(download.suggestedFilename()).toBe("sample.csv");
  expect(fs.readFileSync(await download.path(), "utf8")).toContain("Asha,QA");
  const [report] = await Promise.all([page.waitForEvent("download"), page.getByTestId("dl-generate").click()]);
  expect(report.suggestedFilename()).toBe("report.txt");
});

test("uploads", async ({ page }) => {
  await page.goto("/practice/playwright-files-dialogs");
  await page.getByTestId("up-input").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByTestId("up-file")).toHaveText("notes.txt (5 bytes)");
  await page.getByTestId("up-input").setInputFiles([]);
  await expect(page.getByTestId("up-empty")).toBeVisible();
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByTestId("up-chooser").click()]);
  await chooser.setFiles([{ name: "a.txt", mimeType: "text/plain", buffer: Buffer.from("A") }, { name: "b.txt", mimeType: "text/plain", buffer: Buffer.from("BB") }]);
  await expect(page.getByTestId("up-file")).toHaveCount(2);
  await page.getByTestId("up-send").click();
  await expect(page.getByTestId("up-result")).toContainText("HTTP 201");
});`));
    return () => window.removeEventListener("beforeunload", guard);
  },
});

// ---------------------------------------------------------------- 9 keyboard, mouse & touch
page({
  id: "playwright-input-devices", group: G, title: "Keyboard, mouse & touch",
  blurb: "Event loggers for keys, mouse, wheel, pointer drag, touch taps and the clipboard.",
  tasks: [
    "Compare locator.fill() with locator.pressSequentially(): count the input and keydown events.",
    "Press Control+A, Backspace, Shift+Tab, Enter and ArrowDown with keyboard.press() and read the key log.",
    "Open the command palette with ControlOrMeta+K and close it with Escape.",
    "Use mouse.move(), mouse.down(), mouse.up() and mouse.wheel() on the pad and assert the counters.",
    "Right-click (button: 'right') and double-click (dblclick) the pad.",
    "Drag the custom slider handle with mouse.move/down/up or locator.dragTo() and assert the value.",
    "Create a context with hasTouch: true, then use locator.tap() and a touch swipe on the touch pad.",
    "Grant clipboard permissions, copy text with the button and read it back with navigator.clipboard.readText().",
  ],
  render(root) {
    const klog = h("ul", { "data-testid": "kb-log", "aria-label": "Key log", class: "mono", style: { paddingLeft: "18px", minHeight: "70px", fontSize: ".8rem" } });
    const key = (e) => klog.prepend(h("li", { text: `${e.type} key=${e.key} code=${e.code} ctrl=${e.ctrlKey} shift=${e.shiftKey} alt=${e.altKey} meta=${e.metaKey}` }));
    const keys = h("input", { type: "text", "data-testid": "kb-input", "aria-label": "Key logger input", placeholder: "Press keys here" });
    keys.addEventListener("keydown", (e) => { key(e); while (klog.children.length > 8) klog.lastChild.remove(); });
    keys.addEventListener("keyup", (e) => { key(e); while (klog.children.length > 8) klog.lastChild.remove(); });
    let ie = 0, kd = 0;
    const counts = h("p", { class: "mono", "data-testid": "kb-counts", text: "input events: 0 · keydown events: 0" });
    const cmp = h("input", { type: "text", "data-testid": "kb-compare", "aria-label": "Compare fill and type" });
    cmp.addEventListener("input", () => { ie++; counts.textContent = `input events: ${ie} · keydown events: ${kd}`; });
    cmp.addEventListener("keydown", () => { kd++; counts.textContent = `input events: ${ie} · keydown events: ${kd}`; });
    const reset = btn("Reset counters", "kb-reset", () => { ie = 0; kd = 0; cmp.value = ""; counts.textContent = "input events: 0 · keydown events: 0"; });

    const palette = h("div", { class: "alert info", hidden: true, role: "dialog", "aria-label": "Command palette", "data-testid": "kb-palette" }, h("b", { text: "Command palette" }), h("input", { type: "text", "aria-label": "Command", "data-testid": "kb-palette-input", style: { marginTop: "8px" } }));
    const onDoc = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.hidden = false; palette.querySelector("input").focus(); } else if (e.key === "Escape") palette.hidden = true; };
    document.addEventListener("keydown", onDoc);

    const pad = h("div", { class: "pw-pad", "data-testid": "ms-pad", tabindex: "0", role: "application", "aria-label": "Mouse pad" }, "Mouse pad");
    const coords = h("p", { class: "mono", "data-testid": "ms-coords", text: "x: -, y: -" });
    const tally = { click: 0, dblclick: 0, contextmenu: 0, down: 0, up: 0, wheel: 0 };
    const tallyOut = h("p", { class: "mono", "data-testid": "ms-tally" });
    const drawTally = () => (tallyOut.textContent = Object.entries(tally).map(([k, v]) => `${k}: ${v}`).join(" · "));
    drawTally();
    pad.addEventListener("mousemove", (e) => { const r = pad.getBoundingClientRect(); coords.textContent = `x: ${Math.round(e.clientX - r.left)}, y: ${Math.round(e.clientY - r.top)}`; });
    pad.addEventListener("click", () => { tally.click++; drawTally(); });
    pad.addEventListener("dblclick", () => { tally.dblclick++; drawTally(); });
    pad.addEventListener("contextmenu", (e) => { e.preventDefault(); tally.contextmenu++; drawTally(); });
    pad.addEventListener("mousedown", () => { tally.down++; drawTally(); });
    pad.addEventListener("mouseup", () => { tally.up++; drawTally(); });
    pad.addEventListener("wheel", (e) => { e.preventDefault(); tally.wheel += Math.sign(e.deltaY) || 0; drawTally(); }, { passive: false });

    const track = h("div", { class: "pw-track", "data-testid": "ms-track" }), handle = h("div", { class: "pw-handle", "data-testid": "ms-handle", role: "slider", "aria-label": "Volume", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0", tabindex: "0" });
    const sval = h("p", { class: "mono", "data-testid": "ms-value", text: "0" });
    track.append(handle);
    const setV = (v) => { const p = Math.max(0, Math.min(100, Math.round(v))); handle.style.left = `calc(${p}% - 12px)`; handle.setAttribute("aria-valuenow", String(p)); sval.textContent = String(p); };
    let dragging = false;
    handle.addEventListener("pointerdown", (e) => { dragging = true; handle.setPointerCapture?.(e.pointerId); });
    handle.addEventListener("pointermove", (e) => { if (dragging) { const r = track.getBoundingClientRect(); setV(((e.clientX - r.left) / r.width) * 100); } });
    const stopDrag = () => { dragging = false; };
    handle.addEventListener("pointerup", stopDrag); handle.addEventListener("pointercancel", stopDrag);
    handle.addEventListener("keydown", (e) => { const v = Number(handle.getAttribute("aria-valuenow")); if (e.key === "ArrowRight") setV(v + 5); if (e.key === "ArrowLeft") setV(v - 5); });

    const tp = h("div", { class: "pw-pad", "data-testid": "tc-pad", role: "application", "aria-label": "Touch pad", style: { touchAction: "none" } }, "Touch pad");
    const tcOut = h("p", { class: "mono", "data-testid": "tc-out", text: "taps: 0 · last swipe: none · pointer: -" });
    let taps = 0, swipe = "none", ptype = "-", sx = 0, sy = 0;
    const drawT = () => (tcOut.textContent = `taps: ${taps} · last swipe: ${swipe} · pointer: ${ptype}`);
    tp.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; ptype = e.pointerType; drawT(); });
    tp.addEventListener("pointerup", (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) swipe = dx > 0 ? "right" : "left"; else if (Math.abs(dy) > 40) swipe = dy > 0 ? "down" : "up"; else taps++; drawT(); });

    const src = h("input", { type: "text", value: "copy me", "data-testid": "cb-source", "aria-label": "Text to copy" }), dst = h("input", { type: "text", "data-testid": "cb-target", "aria-label": "Paste target" });
    const cbS = h("p", { class: "mono", "data-testid": "cb-status", role: "status", text: "—" });
    const copyB = btn("Copy", "cb-copy", async () => { try { await navigator.clipboard.writeText(src.value); cbS.textContent = "Copied: " + src.value; } catch (e) { cbS.textContent = "Copy blocked: " + e.name; } });
    const pasteB = btn("Paste", "cb-paste", async () => { try { dst.value = await navigator.clipboard.readText(); cbS.textContent = "Pasted"; } catch (e) { cbS.textContent = "Paste blocked: " + e.name; } });

    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Key logger" }), field("Key logger input", keys), klog),
        stage(h("h2", { text: "fill() vs pressSequentially()" }), field("Compare fill and type", cmp), counts, reset),
        stage(h("h2", { text: "Shortcut" }), h("p", { text: "Press Control+K (or Meta+K) anywhere; Escape closes." }), palette),
        stage(h("h2", { text: "Mouse" }), pad, coords, tallyOut),
        stage(h("h2", { text: "Pointer drag" }), h("div", { style: { padding: "14px 12px" } }, track), sval),
        stage(h("h2", { text: "Touch" }), tp, tcOut),
        stage(h("h2", { text: "Clipboard" }), field("Text to copy", src), h("div", { class: "row" }, copyB, pasteB), field("Paste target", dst), cbS)),
      ref("keyboard, mouse, touch, clipboard", `import { test, expect } from "@playwright/test";

test("fill vs type", async ({ page }) => {
  await page.goto("/practice/playwright-input-devices");
  await page.getByTestId("kb-compare").fill("hello");
  await expect(page.getByTestId("kb-counts")).toContainText("input events: 1");
  await page.getByTestId("kb-reset").click();
  await page.getByTestId("kb-compare").pressSequentially("hello", { delay: 20 });
  await expect(page.getByTestId("kb-counts")).toContainText("input events: 5");
});

test("shortcuts and mouse", async ({ page }) => {
  await page.goto("/practice/playwright-input-devices");
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.getByTestId("kb-palette")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("kb-palette")).toBeHidden();

  const pad = page.getByTestId("ms-pad");
  await pad.dblclick();
  await pad.click({ button: "right" });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.wheel(0, 100);
  await expect(page.getByTestId("ms-tally")).toContainText("dblclick: 1");
  await expect(page.getByTestId("ms-tally")).toContainText("contextmenu: 1");

  const h = (await page.getByTestId("ms-handle").boundingBox())!;
  const t = (await page.getByTestId("ms-track").boundingBox())!;
  await page.mouse.move(h.x + 12, h.y + 12);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, h.y + 12, { steps: 10 });
  await page.mouse.up();
  expect(Number(await page.getByTestId("ms-value").textContent())).toBeGreaterThan(40);
});

test.describe("touch and clipboard", () => {
  test.use({ hasTouch: true, permissions: ["clipboard-read", "clipboard-write"] });
  test("tap and clipboard", async ({ page }) => {
    await page.goto("/practice/playwright-input-devices");
    await page.getByTestId("tc-pad").tap();
    await expect(page.getByTestId("tc-out")).toContainText("taps: 1");
    await page.getByTestId("cb-copy").click();
    await page.getByTestId("cb-paste").click();
    await expect(page.getByTestId("cb-target")).toHaveValue("copy me");
  });
});`));
    return () => document.removeEventListener("keydown", onDoc);
  },
});

// ---------------------------------------------------------------- 10 clock & timers
page({
  id: "playwright-clock", group: G, title: "Clock & timers",
  blurb: "Countdowns, session timeouts, debounce and dates: control time with page.clock instead of waiting.",
  tasks: [
    "Call page.clock.install({ time }) before page.goto() and pin the visible date with page.clock.setFixedTime().",
    "Start the 60 s countdown and use page.clock.fastForward(60_000) to reach “Time’s up!”.",
    "Use page.clock.runFor() to tick the live clock exactly 5 seconds and assert the counter.",
    "Fast-forward 15 minutes and assert the session warning dialog, then 1 more minute for the logout.",
    "Type into the debounced search, fast-forward 500 ms and assert only ONE search ran.",
    "Pause at a date in 2027 and assert the coupon shows “expired”; move back to 2026 and see it valid.",
    "Assert the greeting for 08:00 (“Good morning”) and 20:00 (“Good evening”) using setFixedTime.",
  ],
  render(root) {
    const T = timersOf(); const born = Date.now();
    const now = h("p", { class: "mono", "data-testid": "ck-now", "aria-live": "off" }), date = h("p", { class: "mono", "data-testid": "ck-date" }), greet = h("p", { "data-testid": "ck-greeting" });
    const tick = () => { const d = new Date(); now.textContent = d.toLocaleTimeString("en-GB"); date.textContent = d.toDateString(); const hr = d.getHours(); greet.textContent = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening"; };
    tick(); T.every(tick, 1000);
    let secs = 0; const ticks = h("p", { class: "mono", "data-testid": "ck-ticks", text: "ticks: 0" }); T.every(() => { ticks.textContent = "ticks: " + ++secs; }, 1000);
    const cd = h("p", { class: "mono", "data-testid": "ck-countdown", role: "timer", text: "60" }); let left = 60, cdT = null;
    const cdStart = btn("Start countdown", "ck-start", () => { clearInterval(cdT); left = 60; cd.textContent = "60"; cdT = setInterval(() => { left--; cd.textContent = left > 0 ? String(left) : "Time's up!"; if (left <= 0) clearInterval(cdT); }, 1000); }, "primary");
    const warn = h("div", { class: "alert warn", hidden: true, role: "alert", "data-testid": "ck-session-warning" }, "Your session will expire in 1 minute.");
    const sess = h("p", { class: "mono", "data-testid": "ck-session", text: "Session active" });
    let idle = null, kill = null;
    const arm = () => { clearTimeout(idle); clearTimeout(kill); warn.hidden = true; sess.textContent = "Session active"; idle = setTimeout(() => { warn.hidden = false; }, 15 * 60 * 1000); kill = setTimeout(() => { warn.hidden = true; sess.textContent = "Session expired"; }, 16 * 60 * 1000); };
    arm();
    const active = btn("I am still here", "ck-activity", arm);
    let events = 0, runs = 0; const deb = h("input", { type: "search", "data-testid": "ck-search", "aria-label": "Debounced search" }), debOut = h("p", { class: "mono", "data-testid": "ck-debounce-out", text: "Searches run: 0" }); let dt = null;
    deb.addEventListener("input", () => { events++; clearTimeout(dt); dt = setTimeout(() => { runs++; debOut.textContent = `Searches run: ${runs} (key events: ${events}) · last: "${deb.value}"`; }, 500); });
    const reward = h("p", { class: "alert info", "data-testid": "ck-reward", role: "status" }, "Reward unlocks in 10 s"); T.later(() => { reward.textContent = "Reward unlocked!"; }, 10000);
    const rel = h("p", { "data-testid": "ck-relative" }); const drawRel = () => { const s = Math.floor((Date.now() - born) / 1000); rel.textContent = "Posted " + (s < 5 ? "just now" : s < 60 ? s + " seconds ago" : Math.floor(s / 60) + " minutes ago"); }; drawRel(); T.every(drawRel, 1000);
    const coupon = h("p", { "data-testid": "ck-coupon" }); const cp = () => { coupon.textContent = Date.now() > new Date("2027-01-01T00:00:00Z").getTime() ? "Coupon SPRING26 has expired" : "Coupon SPRING26 is valid until 2027-01-01"; }; cp(); T.every(cp, 1000);
    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Live clock" }), now, date, greet, ticks, rel),
        stage(h("h2", { text: "Countdown" }), cd, cdStart),
        stage(h("h2", { text: "Session timeout (15 min)" }), sess, warn, active),
        stage(h("h2", { text: "Debounce 500 ms" }), field("Debounced search", deb), debOut),
        stage(h("h2", { text: "Delayed reward" }), reward),
        stage(h("h2", { text: "Date-dependent" }), coupon)),
      ref("page.clock", `import { test, expect } from "@playwright/test";

test("fast-forward timers", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-06-01T08:00:00") });
  await page.goto("/practice/playwright-clock");
  await expect(page.getByTestId("ck-greeting")).toHaveText("Good morning");

  await page.getByTestId("ck-start").click();
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId("ck-countdown")).toHaveText("Time's up!");

  await page.clock.runFor(5_000);
  await expect(page.getByTestId("ck-reward")).toHaveText("Reward unlocked!");

  await page.clock.fastForward("15:00");
  await expect(page.getByTestId("ck-session-warning")).toBeVisible();
  await page.clock.fastForward("01:00");
  await expect(page.getByTestId("ck-session")).toHaveText("Session expired");
});

test("debounce runs once", async ({ page }) => {
  await page.clock.install();
  await page.goto("/practice/playwright-clock");
  await page.getByTestId("ck-search").pressSequentially("playwright");
  await page.clock.fastForward(500);
  await expect(page.getByTestId("ck-debounce-out")).toContainText("Searches run: 1");
});

test("pin the date", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2027-03-01T20:00:00"));
  await page.goto("/practice/playwright-clock");
  await expect(page.getByTestId("ck-coupon")).toContainText("expired");
  await expect(page.getByTestId("ck-greeting")).toHaveText("Good evening");
});`));
    return () => { T.clear(); clearInterval(cdT); clearTimeout(idle); clearTimeout(kill); clearTimeout(dt); };
  },
});

// ---------------------------------------------------------------- 11 emulation & permissions
page({
  id: "playwright-emulation", group: G, title: "Emulation & permissions",
  blurb: "Readouts for viewport, locale, timezone, colour scheme, geolocation, permissions and offline mode.",
  tasks: [
    "Set viewport sizes (375×667, 768×1024, 1440×900) and assert the breakpoint badge changes.",
    "Use devices['iPhone 13'] and assert the touch, pointer and user-agent readouts.",
    "Set locale 'de-DE' and timezoneId 'Asia/Kolkata' and assert the formatted date, number and currency.",
    "Emulate colorScheme 'dark' and reducedMotion 'reduce' and assert the readouts.",
    "Grant geolocation with permissions plus geolocation: { latitude, longitude } and assert the coordinates; then deny it.",
    "Query permission states with context.grantPermissions / clearPermissions and the Permissions API button.",
    "Call context.setOffline(true), press “Fetch API health” and assert the failure; go back online.",
    "Disable JavaScript with javaScriptEnabled: false and assert the <noscript> message exists in the HTML.",
  ],
  render(root) {
    const rows = {};
    const row = (k, label) => { rows[k] = h("code", { "data-testid": "em-" + k, text: "—" }); return h("tr", {}, h("th", { scope: "row", text: label }), h("td", {}, rows[k])); };
    const table = h("table", { "data-testid": "em-table" }, h("tbody", {}, [["viewport", "Viewport"], ["dpr", "Device pixel ratio"], ["breakpoint", "Breakpoint"], ["ua", "User agent"], ["lang", "Language"], ["timezone", "Time zone"], ["date", "Formatted date"], ["number", "Formatted number"], ["currency", "Formatted currency"], ["scheme", "Colour scheme"], ["motion", "Reduced motion"], ["pointer", "Pointer"], ["touch", "Touch points"], ["orientation", "Orientation"], ["online", "Online"], ["webdriver", "navigator.webdriver"]].map(([k, l]) => row(k, l))));
    const bp = () => (innerWidth < 600 ? "mobile" : innerWidth < 1024 ? "tablet" : "desktop");
    const mq = (q) => matchMedia(q).matches;
    const paint = () => {
      const d = new Date(Date.UTC(2026, 11, 25, 13, 45));
      const set = (k, v) => { rows[k].textContent = String(v); };
      set("viewport", `${innerWidth}×${innerHeight}`); set("dpr", devicePixelRatio); set("breakpoint", bp()); set("ua", navigator.userAgent); set("lang", navigator.language); set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      set("date", d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })); set("number", (1234567.891).toLocaleString()); set("currency", (1234.5).toLocaleString(undefined, { style: "currency", currency: "EUR" }));
      set("scheme", mq("(prefers-color-scheme: dark)") ? "dark" : "light"); set("motion", mq("(prefers-reduced-motion: reduce)") ? "reduce" : "no-preference"); set("pointer", mq("(pointer: coarse)") ? "coarse" : "fine");
      set("touch", navigator.maxTouchPoints); set("orientation", mq("(orientation: portrait)") ? "portrait" : "landscape"); set("online", navigator.onLine); set("webdriver", navigator.webdriver);
    };
    paint();
    const media = ["(prefers-color-scheme: dark)", "(prefers-reduced-motion: reduce)", "(pointer: coarse)", "(orientation: portrait)"].map((q) => matchMedia(q));
    media.forEach((m) => m.addEventListener("change", paint));
    window.addEventListener("resize", paint); window.addEventListener("online", paint); window.addEventListener("offline", paint);

    const geo = out("em-geo-out"), perm = out("em-perm-out"), net = out("em-fetch-out"), note = out("em-notify-out");
    const geoB = btn("Get my location", "em-geo-btn", () => { if (!navigator.geolocation) { geo.textContent = "Geolocation not supported"; return; } geo.textContent = "Requesting…"; navigator.geolocation.getCurrentPosition((p) => (geo.textContent = pretty({ latitude: +p.coords.latitude.toFixed(4), longitude: +p.coords.longitude.toFixed(4) })), (e) => (geo.textContent = `Error ${e.code}: ${e.message}`), { timeout: 6000 }); });
    const permB = btn("Query permissions", "em-perm-btn", async () => { const res = {}; for (const n of ["geolocation", "notifications", "camera", "microphone"]) { try { res[n] = (await navigator.permissions.query({ name: n })).state; } catch (e) { res[n] = "unsupported"; } } perm.textContent = pretty(res); });
    const noteB = btn("Request notifications", "em-notify-btn", async () => { try { note.textContent = "Permission: " + (typeof Notification === "undefined" ? "unsupported" : await Notification.requestPermission()); } catch (e) { note.textContent = "Error: " + e.name; } });
    const netB = btn("Fetch API health", "em-fetch-btn", async () => { net.textContent = "Fetching…"; const r = await api("GET", "/api/health", undefined, { auth: false }); net.textContent = r.ok ? "Online: HTTP " + r.status : "Request failed: offline or blocked"; });
    root.append(
      h("noscript", {}, h("p", { "data-testid": "em-noscript", text: "JavaScript is disabled. Enable it to use this page." })),
      stage(h("h2", { text: "Environment readout" }), h("div", { class: "tbl-wrap" }, table)),
      h("div", { class: "grid g2", style: { alignItems: "start", marginTop: "18px" } },
        stage(h("h2", { text: "Geolocation" }), geoB, h("div", { class: "result" }, geo)),
        stage(h("h2", { text: "Permissions" }), h("div", { class: "row" }, permB, noteB), h("div", { class: "result" }, perm, note)),
        stage(h("h2", { text: "Network" }), netB, h("div", { class: "result" }, net))),
      ref("emulation matrix", `import { test, expect, devices } from "@playwright/test";

test.describe("mobile", () => {
  test.use({ ...devices["iPhone 13"] });
  test("phone readout", async ({ page }) => {
    await page.goto("/practice/playwright-emulation");
    await expect(page.getByTestId("em-breakpoint")).toHaveText("mobile");
    await expect(page.getByTestId("em-pointer")).toHaveText("coarse");
  });
});

test.describe("german locale", () => {
  test.use({ locale: "de-DE", timezoneId: "Asia/Kolkata", colorScheme: "dark", reducedMotion: "reduce" });
  test("formatting", async ({ page }) => {
    await page.goto("/practice/playwright-emulation");
    await expect(page.getByTestId("em-number")).toHaveText("1.234.567,891");
    await expect(page.getByTestId("em-timezone")).toHaveText("Asia/Calcutta");
    await expect(page.getByTestId("em-scheme")).toHaveText("dark");
    await expect(page.getByTestId("em-motion")).toHaveText("reduce");
  });
});

test.describe("geolocation", () => {
  test.use({ geolocation: { latitude: 48.8584, longitude: 2.2945 }, permissions: ["geolocation"] });
  test("fixed position", async ({ page }) => {
    await page.goto("/practice/playwright-emulation");
    await page.getByTestId("em-geo-btn").click();
    await expect(page.getByTestId("em-geo-out")).toContainText("48.8584");
  });
});

test("offline mode", async ({ page, context }) => {
  await page.goto("/practice/playwright-emulation");
  await context.setOffline(true);
  await page.getByTestId("em-fetch-btn").click();
  await expect(page.getByTestId("em-fetch-out")).toContainText("failed");
  await context.setOffline(false);
  await page.getByTestId("em-fetch-btn").click();
  await expect(page.getByTestId("em-fetch-out")).toContainText("Online");
  await page.setViewportSize({ width: 375, height: 667 });
  await expect(page.getByTestId("em-breakpoint")).toHaveText("mobile");
});`));
    return () => { media.forEach((m) => m.removeEventListener("change", paint)); window.removeEventListener("resize", paint); window.removeEventListener("online", paint); window.removeEventListener("offline", paint); };
  },
});

// ---------------------------------------------------------------- 12 visual & accessibility
page({
  id: "playwright-visual-a11y", group: G, title: "Visual & a11y testing",
  blurb: "Screenshot baselines with masks, ARIA snapshots and a form with real, fixable accessibility defects.",
  tasks: [
    "Take expect(locator).toHaveScreenshot() of the stable card and commit the baseline with --update-snapshots.",
    "Screenshot the animated area: fix it with mask, animations: 'disabled' and caret: 'hide'.",
    "Toggle the cookie banner (layout shift) and show how maxDiffPixels / threshold tolerate or catch it.",
    "Switch to “Inaccessible” and run @axe-core/playwright: list the violations (image-alt, label, color-contrast, heading-order, button-name, link-name).",
    "Switch to “Accessible” and assert zero violations; capture toMatchAriaSnapshot() of the landmark region.",
    "Navigate the form with Tab only and assert focus order with toBeFocused().",
    "Use page.emulateMedia({ colorScheme: 'dark' }) and add a second baseline.",
  ],
  render(root) {
    const T = timersOf();
    const banner = h("div", { class: "alert info", "data-testid": "vz-banner", hidden: true }, "We use cookies. Accept?");
    const stable = h("div", { class: "shop-card", "data-testid": "vz-stable", style: { maxWidth: "280px" } }, banner, h("div", { class: "emoji", "aria-hidden": "true" }, "⌨️"), h("b", { text: "Mechanical Keyboard" }), h("span", { class: "muted", text: "Hot-swappable switches" }), h("span", { class: "tag ok", text: "In stock" }));
    const cookie = h("input", { type: "checkbox", id: "vz-cookie", "data-testid": "vz-cookie-toggle" });
    cookie.addEventListener("change", () => { banner.hidden = !cookie.checked; });
    const clock = h("span", { class: "mono", "data-testid": "vz-clock" }); const tick = () => (clock.textContent = new Date().toLocaleTimeString("en-GB")); tick(); T.every(tick, 1000);
    const rnd = h("b", { "data-testid": "vz-random" }); const shuffle = () => (rnd.textContent = "Order #" + rand(10000, 99999)); shuffle();
    const animated = h("div", { class: "shop-card", "data-testid": "vz-animated", style: { maxWidth: "280px" } }, h("div", { class: "row" }, h("span", { class: "spinner", "aria-hidden": "true" }), clock), rnd, btn("New number", "vz-shuffle", shuffle, "sm"));
    const mode = h("select", { "data-testid": "vz-mode", "aria-label": "Form mode", style: { width: "auto" } }, h("option", { value: "bad", text: "Inaccessible" }), h("option", { value: "good", text: "Accessible" }));
    const demo = h("div", { "data-testid": "vz-demo" });
    const drawDemo = () => {
      const bad = mode.value === "bad";
      demo.replaceChildren(bad
        ? h("div", { "data-testid": "vz-bad-form", style: { background: "#fff", color: "#bbb", padding: "14px", borderRadius: "10px" } },
          h("h4", { style: { margin: "0 0 8px" } }, "Newsletter signup"),
          h("img", { src: "/favicon.svg", width: 32, height: 32, "data-testid": "vz-bad-img" }),
          h("p", { style: { color: "#c8c8c8" } }, "Get updates in your inbox"),
          h("input", { type: "text", placeholder: "Your name", "data-testid": "vz-bad-name" }), h("input", { type: "text", placeholder: "Email", "data-testid": "vz-bad-email", style: { marginTop: "6px" } }),
          h("div", { class: "pw-fakebtn", "data-testid": "vz-bad-submit", onClick: () => toast("Fake button clicked", "warn") }, "Subscribe"),
          h("button", { type: "button", class: "btn sm", "data-testid": "vz-bad-close" }, h("span", { "aria-hidden": "true", text: "✕" })),
          h("a", { href: "https://example.test/", "data-testid": "vz-bad-link", onClick: (e) => e.preventDefault() }, h("span", { "aria-hidden": "true", text: "→" })))
        : h("section", { "aria-label": "Newsletter signup", "data-testid": "vz-good-form", style: { background: "var(--surface-2)", padding: "14px", borderRadius: "10px" } },
          h("h3", { text: "Newsletter signup" }), h("img", { src: "/favicon.svg", width: 32, height: 32, alt: "TestYard logo", "data-testid": "vz-good-img" }),
          h("p", { text: "Get updates in your inbox" }),
          h("form", { onSubmit: (e) => { e.preventDefault(); toast("Subscribed", "ok"); } },
            field("Your name", h("input", { type: "text", autocomplete: "name", "data-testid": "vz-good-name" })), field("Email address", h("input", { type: "email", autocomplete: "email", "data-testid": "vz-good-email" })),
            h("button", { type: "submit", class: "btn primary", "data-testid": "vz-good-submit" }, "Subscribe"), " ",
            h("a", { href: "/practice/playwright-visual-a11y", "data-testid": "vz-good-link" }, "Read the privacy policy"))));
    };
    mode.addEventListener("change", drawDemo); drawDemo();
    const rules = [["image-alt", "Images must have alternative text"], ["label", "Form elements must have labels"], ["color-contrast", "Text needs sufficient contrast"], ["button-name", "Buttons need discernible text"], ["link-name", "Links need discernible text"], ["heading-order", "Heading levels should only increase by one"]];
    root.append(
      h("div", { class: "grid g2", style: { alignItems: "start" } },
        stage(h("h2", { text: "Deterministic card" }), stable, h("label", { class: "check", for: "vz-cookie", style: { marginTop: "10px" } }, cookie, "Show cookie banner (layout shift)")),
        stage(h("h2", { text: "Animated & random (mask me)" }), animated)),
      stage(h("h2", { text: "Accessibility lab" }), h("div", { class: "row", style: { marginBottom: "12px" } }, h("label", { for: "vz-mode", text: "Mode" }), mode), demo,
        h("div", { class: "tbl-wrap", style: { marginTop: "14px" } }, h("table", { "data-testid": "vz-rules" }, h("thead", {}, h("tr", {}, ["axe rule", "What it checks"].map((t) => h("th", { text: t })))), h("tbody", {}, rules.map(([a, b]) => h("tr", {}, h("td", { class: "mono", text: a }), h("td", { text: b }))))))),
      ref("screenshots, axe and ARIA snapshots", `import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("visual baseline with masks", async ({ page }) => {
  await page.goto("/practice/playwright-visual-a11y");
  await expect(page.getByTestId("vz-stable")).toHaveScreenshot("card.png");
  await expect(page.getByTestId("vz-animated")).toHaveScreenshot("animated.png", {
    mask: [page.getByTestId("vz-clock"), page.getByTestId("vz-random")],
    animations: "disabled",
    caret: "hide",
  });
  await page.getByTestId("vz-cookie-toggle").check();
  await expect(page.getByTestId("vz-stable")).toHaveScreenshot("card-banner.png", { maxDiffPixelRatio: 0.02 });
});

test("axe finds the defects, then finds none", async ({ page }) => {
  await page.goto("/practice/playwright-visual-a11y");
  const bad = await new AxeBuilder({ page }).include("[data-testid=vz-demo]").analyze();
  expect(bad.violations.map((v) => v.id)).toEqual(expect.arrayContaining(["image-alt", "label", "color-contrast"]));

  await page.getByTestId("vz-mode").selectOption("good");
  const good = await new AxeBuilder({ page }).include("[data-testid=vz-demo]").analyze();
  expect(good.violations).toEqual([]);
  await expect(page.getByTestId("vz-demo")).toMatchAriaSnapshot(\`
    - region "Newsletter signup":
      - heading "Newsletter signup" [level=3]
      - img "TestYard logo"
      - paragraph: Get updates in your inbox
      - textbox "Your name"
      - textbox "Email address"
      - button "Subscribe"
      - link "Read the privacy policy"
  \`);
});`));
    return T.clear;
  },
});
