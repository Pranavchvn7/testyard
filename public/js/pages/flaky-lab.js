import { page } from "../registry.js";
import { h, stage, field, rand, pick, shuffle, api, store } from "../ui.js";

// ---------------------------------------------------------------- shared helpers
/** Timer bag: everything scheduled through it is cancelled when the page is left. */
function bag() {
  const ts = new Set(), is = new Set();
  const t = {
    dead: false,
    after(fn, ms) { const id = setTimeout(() => { ts.delete(id); if (!t.dead) fn(); }, ms); ts.add(id); return id; },
    every(fn, ms) { const id = setInterval(() => { if (!t.dead) fn(); }, ms); is.add(id); return id; },
    stop(id) { clearTimeout(id); clearInterval(id); ts.delete(id); is.delete(id); },
    clear() { t.dead = true; ts.forEach(clearTimeout); is.forEach(clearInterval); ts.clear(); is.clear(); },
  };
  return t;
}
const scenario = (id, title, flake, ...kids) =>
  h("section", { class: "stage fl-scenario", id: "scn-" + id, "data-testid": "scn-" + id },
    h("h2", { text: title }), h("p", { class: "hint" }, h("b", { text: "The flake: " }), flake), ...kids);
const jumpBar = (items) =>
  h("div", { class: "fl-jump", role: "navigation", "aria-label": "Scenarios", "data-testid": "jump-bar" },
    items.map(([id, label]) => h("button", { class: "btn sm", type: "button", "data-testid": "jump-" + id, onClick: () => document.getElementById("scn-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" }) }, label)));
const check = (label, testid, checked, onChange) => {
  const box = h("input", { type: "checkbox", "data-testid": testid, checked: checked || null });
  box.addEventListener("change", () => onChange(box.checked));
  return h("label", { class: "check" }, box, label);
};
const btn = (label, testid, onClick, cls = "btn") => h("button", { class: cls, type: "button", "data-testid": testid, onClick }, label);

// ================================================================ page 1: UI timing & actionability
function scLate(T) {
  const go = h("button", { class: "btn primary", type: "button", disabled: true, "data-testid": "late-btn" }, "Submit");
  const status = h("p", { class: "mono", role: "status", "data-testid": "late-status" }, "Waiting…");
  const clicks = h("p", { class: "mono", "data-testid": "late-clicks" }, "Submitted: 0 times");
  let n = 0, timer;
  go.addEventListener("click", () => { n++; clicks.textContent = `Submitted: ${n} time${n === 1 ? "" : "s"}`; });
  const arm = () => {
    T.stop(timer); go.disabled = true; status.textContent = "Waiting…";
    const d = rand(800, 5000);
    timer = T.after(() => { go.disabled = false; status.textContent = `Enabled after ${d} ms`; }, d);
  };
  arm();
  return scenario("late", "1 · Button enabled after a random delay", "The Submit button becomes enabled between 0.8 s and 5 s after load. A fixed sleep is either too short (red build) or too long (slow suite).",
    h("div", { class: "row" }, go, btn("Re-arm with a new random delay", "late-reset", arm)), status, clicks);
}

function scRerender(T) {
  const host = h("div", { "data-testid": "rerender-host" });
  const sel = h("select", { "data-testid": "rerender-interval", "aria-label": "Re-render interval", style: { width: "auto" } }, [500, 1000, 2000, 5000].map((v) => h("option", { value: v, selected: v === 1000, text: v + " ms" })));
  const out = h("p", { class: "mono", "data-testid": "rerender-count" });
  let clicks = 0, renders = 0, iv;
  const upd = () => (out.textContent = `Clicks landed: ${clicks} · Re-renders: ${renders}`);
  const mk = () => h("button", { class: "btn", type: "button", "data-testid": "rerender-btn", onClick: () => { clicks++; upd(); } }, "Click me (I get replaced)");
  const start = () => { T.stop(iv); iv = T.every(() => { host.replaceChildren(mk()); renders++; upd(); }, +sel.value); };
  host.append(mk()); upd(); sel.addEventListener("change", start); start();
  return scenario("rerender", "2 · Element that is re-rendered under your feet", "The framework throws the button away and builds a new one on a timer. A handle you saved earlier points at a detached node (StaleElementReferenceException, “element is not attached”).",
    h("div", { class: "row" }, field("Re-render every", sel)), host, out);
}

function scCover(T) {
  const target = h("button", { class: "btn primary", type: "button", "data-testid": "cover-btn" }, "Pay now");
  const overlay = h("div", { class: "fl-overlay", hidden: true, role: "presentation", "data-testid": "cover-overlay" }, "Please wait…");
  const out = h("p", { class: "mono", role: "status", "data-testid": "cover-count" });
  let ok = 0, blocked = 0, gen = 0;
  const upd = () => (out.textContent = `Landed on the button: ${ok} · Intercepted by the overlay: ${blocked}`);
  target.addEventListener("click", () => { ok++; upd(); });
  overlay.addEventListener("click", () => { blocked++; upd(); });
  const cycle = (g) => {
    T.after(() => {
      if (g !== gen) return;
      overlay.hidden = false;
      T.after(() => { overlay.hidden = true; if (g === gen) cycle(g); }, rand(900, 2200));
    }, rand(600, 2500));
  };
  const toggle = (on) => { gen++; if (on) cycle(gen); else overlay.hidden = true; };
  toggle(true); upd();
  return scenario("cover", "3 · An overlay randomly covers the button", "A “please wait” layer slides over the button for 1–2 s at random moments. The click lands on the overlay instead (Playwright: “<div> intercepts pointer events”, Selenium: ElementClickInterceptedException).",
    h("div", { style: { marginBottom: "12px" } }, check("Random overlay enabled", "cover-toggle", true, toggle)),
    h("div", { class: "fl-cover-wrap", "data-testid": "cover-wrap" }, target, overlay), out);
}

function scMove(T) {
  const mover = h("button", { class: "btn primary fl-mover", type: "button", "data-testid": "move-btn" }, "Catch me");
  const track = h("div", { class: "fl-track", "data-testid": "move-track" }, mover);
  const out = h("p", { class: "mono", "data-testid": "move-count" }, "Clicks: 0");
  let n = 0;
  mover.addEventListener("click", () => { n++; out.textContent = "Clicks: " + n; });
  let pauseBox;
  const setPaused = (p) => { track.classList.toggle("fl-paused", p); if (pauseBox) pauseBox.checked = p; };
  const label = check("Pause the animation", "move-pause", false, setPaused);
  pauseBox = label.querySelector("input");
  return scenario("move", "4 · A button that is still moving", "The button slides back and forth. Playwright waits until its position is stable for two frames; a Selenium click lands on the spot the button has already left.",
    h("div", { class: "row", style: { marginBottom: "12px" } }, label, btn("Pause automatically in 4 s", "move-auto", () => T.after(() => setPaused(true), 4000), "btn sm")), track, out);
}

function scToast(T) {
  const slot = h("div", { style: { minHeight: "42px" }, "data-testid": "fast-toast-slot" });
  const log = h("p", { class: "mono", "data-testid": "fast-toast-log" }, "Toasts shown: 0");
  let n = 0, last = "";
  const save = () => {
    n++;
    const d = rand(300, 2500);
    const t = h("div", { class: "fl-toast", role: "status", "data-testid": "fast-toast" }, "Saved!");
    slot.replaceChildren(t);
    T.after(() => { t.remove(); last = ` · last toast stayed ${d} ms`; log.textContent = `Toasts shown: ${n}${last}`; }, d);
    log.textContent = `Toasts shown: ${n}${last}`;
  };
  return scenario("toast", "5 · A toast that vanishes after a random time", "“Saved!” stays on screen for 0.3–2.5 s. A test that clicks, takes a screenshot, then looks for the toast sometimes finds nothing.",
    h("div", { class: "row" }, btn("Save", "fast-toast-btn", save, "btn primary")), h("div", { style: { margin: "12px 0" } }, slot), log);
}

function scReorder(T) {
  const names = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];
  let order = [...names];
  const list = h("ul", { "data-testid": "reorder-list", style: { listStyle: "none", padding: 0, margin: "0 0 10px" } });
  const out = h("p", { class: "mono", role: "status", "data-testid": "reorder-picked" }, "Picked: —");
  const draw = () => list.replaceChildren(...order.map((n) => h("li", { class: "row", "data-item": n.toLowerCase(), style: { padding: "3px 0" } },
    h("span", { style: { minWidth: "110px" }, text: n }), btn("Pick", "reorder-pick-" + n.toLowerCase(), () => { out.textContent = "Picked: " + n; }, "btn sm"))));
  let paused = false;
  draw();
  T.every(() => { if (!paused) { order = shuffle(order); draw(); } }, 1500);
  return scenario("reorder", "6 · A list that reorders itself", "The rows are shuffled every 1.5 s. “Click the 2nd Pick button” hits a different fruit every run; locating by name or test id is the only stable approach.",
    h("div", { style: { marginBottom: "8px" } }, check("Pause shuffling", "reorder-pause", false, (v) => (paused = v))), list, out);
}

function scAb(T) {
  const V = { a: ["Welcome back", "Start free trial"], b: ["Hello there", "Get started"], c: ["Join today", "Sign up now"] };
  const forced = new URLSearchParams(location.search).get("variant");
  let key = V[forced] ? forced : pick(Object.keys(V));
  const head = h("p", { style: { fontFamily: "var(--serif)", fontSize: "1.4rem", margin: "0 0 8px" }, "data-testid": "ab-heading" });
  const cta = h("button", { class: "btn primary", type: "button", "data-testid": "ab-cta" });
  const tag = h("span", { class: "tag acc", "data-testid": "ab-variant" });
  const draw = () => { head.textContent = V[key][0]; cta.textContent = V[key][1]; cta.dataset.variant = key; tag.textContent = `Variant ${key.toUpperCase()}${V[forced] ? " (forced by ?variant=)" : ""}`; };
  draw();
  return scenario("ab", "7 · Random A/B text variant", "The heading and button label are picked at random on every visit. Text locators match one variant only. Append ?variant=a, ?variant=b or ?variant=c to the URL to force one.",
    head, h("div", { class: "row" }, cta, tag, btn("Re-roll variant", "ab-reroll", () => { key = pick(Object.keys(V).filter((k) => k !== key)); draw(); }, "btn sm")));
}

function scCookie(T) {
  const area = h("div", { class: "fl-cookie-area", "data-testid": "cookie-area" }, h("p", { class: "muted", text: "Pretend this is a shop page. The banner may cover the checkout button." }));
  const cont = h("button", { class: "btn primary fl-continue", type: "button", "data-testid": "cookie-continue" }, "Continue to checkout");
  const state = h("p", { class: "mono", role: "status", "data-testid": "cookie-state" });
  const done = h("p", { class: "mono", "data-testid": "cookie-continued" }, "Continued: 0 times");
  let banner = null, timer, n = 0;
  const dismiss = (how) => { banner?.remove(); banner = null; state.textContent = `Banner: dismissed (${how})`; };
  cont.addEventListener("click", () => { n++; done.textContent = `Continued: ${n} time${n === 1 ? "" : "s"}`; });
  area.append(cont);
  const load = () => {
    T.stop(timer); banner?.remove(); banner = null;
    if (Math.random() < 0.65) {
      state.textContent = "Banner: not shown yet…";
      timer = T.after(() => {
        banner = h("div", { class: "fl-banner", role: "dialog", "aria-label": "Cookie consent", "data-testid": "cookie-banner" },
          h("span", { text: "We use cookies to improve your experience." }),
          btn("Accept all", "cookie-accept", () => dismiss("accepted"), "btn sm primary"), btn("Reject", "cookie-reject", () => dismiss("rejected"), "btn sm"));
        area.append(banner); state.textContent = "Banner: visible";
      }, rand(500, 3500));
    } else state.textContent = "Banner: will not appear this time";
  };
  load();
  return scenario("cookie", "8 · A cookie banner that sometimes appears", "On about 65 % of loads a consent banner appears 0.5–3.5 s later and covers the checkout button. A test that always clicks “Accept” fails when the banner is absent.",
    h("div", { class: "row", style: { marginBottom: "12px" } }, btn("Simulate a fresh page load", "cookie-load", load), state), area, done);
}

function scFocus(T) {
  const main = h("input", { type: "text", "data-testid": "focus-main", placeholder: "Type your name…", "aria-label": "Your name" });
  const thief = h("input", { type: "text", "data-testid": "focus-thief", placeholder: "Newsletter e-mail", "aria-label": "Newsletter e-mail" });
  const out = h("p", { class: "mono", role: "status", "data-testid": "focus-count" }, "Focus stolen: 0 times");
  let on = true, n = 0;
  T.every(() => {
    if (on && document.activeElement === main && Math.random() < 0.5) { thief.focus(); n++; out.textContent = `Focus stolen: ${n} time${n === 1 ? "" : "s"}`; }
  }, 1200);
  return scenario("focus", "9 · An input that loses focus while you type", "Every 1.2 s a widget may pull the focus into the Newsletter field. Keystrokes then end up in the wrong input (typing “Sam” gives “Sa” + “m”).",
    h("div", { style: { marginBottom: "10px" } }, check("Steal focus at random", "focus-toggle", true, (v) => (on = v))), h("div", { class: "grid g2" }, field("Your name", main), field("Newsletter e-mail", thief)), out);
}

function scHover(T) {
  const wrap = h("div", { style: { position: "relative", display: "inline-block", minHeight: "40px" } });
  const trigger = h("button", { class: "btn", type: "button", "aria-haspopup": "menu", "aria-expanded": "false", "data-testid": "hover-trigger" }, "Account ▾");
  const log = h("p", { class: "mono", role: "status", "data-testid": "hover-log" }, "Clicked: —");
  const item = (label) => h("button", { role: "menuitem", type: "button", "data-testid": "hover-item-" + label.toLowerCase(), onClick: () => { log.textContent = "Clicked: " + label; close(); } }, label);
  const menu = h("div", { class: "menu", role: "menu", hidden: true, "data-testid": "hover-menu", style: { top: "100%", left: "0", marginTop: "4px" } }, item("Profile"), item("Logout"));
  let timer;
  const close = () => { T.stop(timer); menu.hidden = true; trigger.setAttribute("aria-expanded", "false"); };
  const open = () => { T.stop(timer); menu.hidden = false; trigger.setAttribute("aria-expanded", "true"); timer = T.after(close, rand(400, 1500)); };
  wrap.addEventListener("mouseenter", open);
  trigger.addEventListener("click", () => (menu.hidden ? open() : close()));
  wrap.append(trigger, menu);
  return scenario("hover", "10 · A hover menu that closes by itself", "The menu opens on hover but closes after a random 0.4–1.5 s even while the pointer is still over it. mouseenter only fires again after the pointer left, so a second hover() does nothing.",
    h("div", { style: { minHeight: "110px" } }, wrap), log);
}

function scDup(T) {
  let busy = false, orders = 0, guard = false;
  const submit = h("button", { class: "btn primary", type: "button", "data-testid": "dup-submit" }, "Place order");
  const count = h("p", { class: "mono", role: "status", "data-testid": "dup-count" }, "Orders created: 0");
  const state = h("p", { class: "mono", "data-testid": "dup-state" }, "Idle");
  submit.addEventListener("click", () => {
    if (guard && busy) return;
    busy = true; state.textContent = "Processing…"; if (guard) submit.disabled = true;
    T.after(() => { orders++; busy = false; submit.disabled = false; count.textContent = `Orders created: ${orders}`; state.textContent = "Done"; }, 1000);
  });
  return scenario("dup", "11 · Double click creates a duplicate", "Processing takes one second and nothing stops a second click. Two quick clicks (or a retry after a timeout) create two orders; the assertion “exactly one order” becomes intermittent.",
    h("div", { style: { marginBottom: "10px" } }, check("Disable the button while processing (the fix)", "dup-guard", false, (v) => (guard = v))),
    h("div", { class: "row" }, submit, btn("Reset", "dup-reset", () => { orders = 0; busy = false; submit.disabled = false; count.textContent = "Orders created: 0"; state.textContent = "Idle"; }, "btn sm")), state, count);
}

function scIframe(T) {
  const frame = h("iframe", { title: "Flaky frame", name: "flaky-frame", "data-testid": "iframe-flaky", style: { width: "100%", height: "112px", border: "1px solid var(--line)", borderRadius: "8px" } });
  const info = h("p", { class: "mono", role: "status", "data-testid": "iframe-loads" }, "Frame documents loaded: 0");
  let loads = 0, gen = 0, auto = true;
  const html = () => `<body style="font:14px system-ui;margin:12px"><!-- ${Date.now()} --><button id="frame-btn" style="padding:8px 12px">Click inside the frame</button><p id="frame-out" style="margin:10px 0 0">Document #${loads + 1} · clicks: 0</p></body>`;
  frame.addEventListener("load", () => {
    loads++; info.textContent = `Frame documents loaded: ${loads}`;
    const d = frame.contentDocument; let n = 0;
    const out = d?.getElementById("frame-out");
    d?.getElementById("frame-btn")?.addEventListener("click", () => { n++; if (out) out.textContent = `Document #${loads} · clicks: ${n}`; });
  });
  const reload = () => { frame.srcdoc = html(); };
  const loop = (g) => T.after(() => { if (g !== gen) return; if (auto) reload(); loop(g); }, rand(3000, 6000));
  reload(); loop(gen);
  return scenario("iframe", "12 · An iframe that reloads itself", "The frame document is replaced every 3–6 s. Any Frame handle or element handle taken before the reload is dead; frameLocator() / switch_to.frame must be redone.",
    h("div", { class: "row", style: { marginBottom: "10px" } }, check("Reload automatically", "iframe-auto", true, (v) => (auto = v)), btn("Reload now", "iframe-reload-now", reload, "btn sm")), frame, info);
}

page({
  id: "flaky-lab", group: "dynamic", title: "Flaky test lab",
  blurb: "Twelve classic UI flakes: late buttons, overlays, moving targets, stale nodes, vanishing toasts and more.",
  tasks: [
    "Click the late-enabled Submit button with auto-waiting only: no sleep, no waitForTimeout. Prove it with npx playwright test --repeat-each=20.",
    "Read Playwright’s call log when the overlay covers Pay now (“<div> intercepts pointer events”) and explain why force: true is the wrong fix.",
    "Click the moving button: let actionability (stable) wait for it, then pause the animation and compare the timings in the trace viewer.",
    "Assert the vanishing toast with a web-first assertion: await expect(page.getByTestId('fast-toast')).toBeVisible() started right after the click.",
    "Pick Banana while the list reshuffles; explain why nth() is the wrong locator and getByTestId('reorder-pick-banana') is the right one.",
    "Force each A/B variant with ?variant=a|b|c and assert the matching heading and button pair.",
    "Dismiss the cookie banner only when it shows up (page.addLocatorHandler) and keep the checkout flow unchanged.",
    "Type “Sam” into the focus-stealing field and make the assertion robust with expect(input).toHaveValue('Sam') plus a retry via expect(...).toPass().",
    "Hover Account and click Logout inside the auto-closing menu: decide between clicking the trigger and hover + immediate click.",
    "Place exactly one order and assert the count, then break it with dblclick() and fix the app with the guard checkbox.",
    "Click the button inside the reloading iframe with page.frameLocator('iframe[name=flaky-frame]') and explain why a cached Frame object fails.",
  ],
  render(root) {
    const T = bag();
    root.append(
      jumpBar([["late", "1 Late"], ["rerender", "2 Re-render"], ["cover", "3 Overlay"], ["move", "4 Moving"], ["toast", "5 Toast"], ["reorder", "6 Reorder"], ["ab", "7 A/B"], ["cookie", "8 Cookie"], ["focus", "9 Focus"], ["hover", "10 Hover"], ["dup", "11 Double click"], ["iframe", "12 Iframe"]]),
      scLate(T), scRerender(T), scCover(T), scMove(T), scToast(T), scReorder(T), scAb(T), scCookie(T), scFocus(T), scHover(T), scDup(T), scIframe(T));
    return () => T.clear();
  },
});

// ================================================================ page 2: network & async
function scFailFirst() {
  let attempts = 0;
  const n = h("input", { type: "number", min: "0", max: "10", value: "2", "data-testid": "ffn-n", "aria-label": "Fail the first N calls", style: { width: "100px" } });
  const log = h("ol", { class: "mono", "data-testid": "ffn-log", style: { paddingLeft: "22px" } });
  const out = h("div", { role: "status", "data-testid": "ffn-result" });
  const att = h("p", { class: "mono", "data-testid": "ffn-attempts" }, "Attempts so far: 0");
  const call = async () => {
    const my = ++attempts;
    att.textContent = "Attempts so far: " + attempts;
    const r = await api("GET", "/api/flaky?failRate=" + (my <= (Number(n.value) || 0) ? 1 : 0), undefined, { auth: false });
    log.append(h("li", { text: `Attempt ${my} → HTTP ${r.status}` }));
    out.replaceChildren(h("div", { class: "alert " + (r.ok ? "ok" : "bad"), text: r.ok ? `Success on attempt ${my}` : `HTTP ${r.status}: ${r.data?.message || "failed"} (attempt ${my})` }));
  };
  return scenario("failfirst", "1 · Fails the first N calls, then succeeds", "The first calls return HTTP 503 and later ones succeed (typical for cold starts and rate limits). A test without retry logic is red until the service warms up.",
    h("div", { class: "row" }, field("Fail the first N calls", n), btn("Call the API", "ffn-call", call, "btn primary"), btn("Reset counter", "ffn-reset", () => { attempts = 0; log.replaceChildren(); out.replaceChildren(); att.textContent = "Attempts so far: 0"; }, "btn sm")), att, out, log);
}

function scRate(T) {
  const slider = h("input", { type: "range", min: "0", max: "100", value: "30", "data-testid": "rate-slider", "aria-label": "Failure rate" });
  const lab = h("span", { class: "tag acc", "data-testid": "rate-label", text: "30%" });
  const stats = h("p", { class: "mono", role: "status", "data-testid": "rate-stats" }, "Run the batch to measure the real failure ratio.");
  const grid = h("div", { class: "fl-grid", "data-testid": "rate-grid" });
  slider.addEventListener("input", () => (lab.textContent = slider.value + "%"));
  const run = h("button", { class: "btn primary", type: "button", "data-testid": "rate-run20" }, "Run 20 calls");
  run.addEventListener("click", async () => {
    run.disabled = true; grid.replaceChildren(); let bad = 0;
    for (let i = 1; i <= 20 && !T.dead; i++) {
      const r = await api("GET", `/api/flaky?failRate=${Number(slider.value) / 100}`, undefined, { auth: false });
      if (!r.ok) bad++;
      grid.append(h("i", { class: "fl-dot" + (r.ok ? "" : " bad"), title: `Call ${i}: HTTP ${r.status}` }));
      stats.textContent = `Calls: ${i}/20 · Failures: ${bad} (${Math.round((bad / i) * 100)}%)`;
    }
    run.disabled = false;
  });
  return scenario("rate", "2 · Intermittent failures with a chosen rate", "Each call fails with the probability you set. Measure the real ratio over many runs instead of trusting a single green or red result.",
    h("div", { class: "row", style: { flexWrap: "nowrap" } }, slider, lab), h("div", { class: "row", style: { margin: "12px 0" } }, run), stats, grid);
}

function scRace() {
  const input = h("input", { type: "text", autocomplete: "off", "data-testid": "race-input", placeholder: "Type “play” quickly", "aria-label": "Search" });
  const forEl = h("p", { class: "mono", role: "status", "data-testid": "race-for" }, "Showing results for: —");
  const list = h("ul", { class: "dl-list", "data-testid": "race-results" });
  const log = h("ol", { class: "mono", "data-testid": "race-log", style: { paddingLeft: "22px" } });
  let seq = 0, fix = false;
  input.addEventListener("input", async () => {
    const q = input.value.trim(), mine = ++seq;
    if (!q) { forEl.textContent = "Showing results for: —"; list.replaceChildren(); return; }
    const r = await api("GET", "/api/search?q=" + encodeURIComponent(q), undefined, { auth: false });
    log.append(h("li", { text: `Response for “${q}” arrived (HTTP ${r.status}${r.ok ? ", " + r.data.data.tookMs + " ms server delay" : ""})` }));
    if (fix && mine !== seq) return;
    if (!r.ok) { forEl.textContent = `Search failed: HTTP ${r.status}`; list.replaceChildren(); return; }
    forEl.textContent = `Showing results for: “${r.data.data.q}”`;
    list.replaceChildren(...r.data.data.results.map((w) => h("li", { "data-testid": "race-item", text: w })));
  });
  return scenario("race", "3 · A race condition: the stale response wins", "Shorter queries are answered later by the server. Without cancelling old requests the UI ends up showing results for “p” although the box says “play”. Retrying the assertion cannot fix a product bug.",
    field("Search", input), h("div", { style: { marginBottom: "10px" } }, check("Ignore stale responses (the fix)", "race-fix", false, (v) => (fix = v))), forEl, list,
    h("div", { class: "label", style: { margin: "12px 0 4px" }, text: "Response arrival order" }), log, btn("Clear log", "race-clear", () => log.replaceChildren(), "btn sm"));
}

function scOrder(T) {
  const names = ["A", "B", "C", "D"];
  const panels = names.map((n) => h("div", { class: "shop-card", "data-testid": "order-panel-" + n.toLowerCase() }, h("b", { text: "Panel " + n }), h("span", { class: "muted", text: "idle" })));
  const log = h("ol", { class: "mono", "data-testid": "order-log", style: { paddingLeft: "22px" } });
  const load = () => {
    log.replaceChildren();
    panels.forEach((p, i) => {
      p.lastChild.textContent = "loading…";
      const d = rand(200, 2500);
      T.after(() => { p.lastChild.textContent = `loaded in ${d} ms`; log.append(h("li", { text: `Panel ${names[i]} arrived`, "data-panel": names[i].toLowerCase() })); }, d);
    });
  };
  return scenario("order", "4 · Async results arrive in random order", "Four panels load independently, each after 0.2–2.5 s. Asserting “the first row of the log is panel A” passes about one run in four.",
    h("div", { class: "row", style: { marginBottom: "12px" } }, btn("Load four panels", "order-load", load, "btn primary")), h("div", { class: "grid g2" }, panels), h("div", { class: "label", style: { margin: "12px 0 4px" }, text: "Arrival order" }), log);
}

function scLateSelect(T) {
  const sel = h("select", { "data-testid": "late-select", "aria-label": "T-shirt size" }, h("option", { value: "", text: "Loading options…" }));
  const out = h("p", { class: "mono", role: "status", "data-testid": "late-select-out" }, "Selected: —");
  let timer;
  sel.addEventListener("change", () => (out.textContent = "Selected: " + (sel.value || "—")));
  const load = () => {
    T.stop(timer); sel.disabled = true; out.textContent = "Selected: —";
    sel.replaceChildren(h("option", { value: "", text: "Loading options…" }));
    timer = T.after(() => {
      sel.replaceChildren(h("option", { value: "", text: "Choose a size" }), ...["Small", "Medium", "Large", "XL"].map((s) => h("option", { value: s.toLowerCase(), text: s })));
      sel.disabled = false;
    }, rand(1000, 4000));
  };
  load();
  return scenario("select", "5 · Dropdown options that load late", "The select is disabled and holds one placeholder option until a random 1–4 s timer fires. Selenium’s Select() on the placeholder finds no “Large”.",
    h("div", { class: "row" }, field("Size", sel), btn("Reload options", "late-select-reload", load, "btn sm")), out);
}

function scOffline(T) {
  let offline = false, flap = null;
  const status = h("span", { class: "pill up", "data-testid": "net-status", role: "status" }, "Online");
  const out = h("div", { "data-testid": "net-out", "data-state": "idle", role: "status" }, "No request yet.");
  const sw = check("Simulate offline", "net-offline", false, (v) => setOffline(v));
  const setOffline = (v) => { offline = v; status.className = "pill " + (v ? "down" : "up"); status.textContent = v ? "Offline" : "Online"; sw.querySelector("input").checked = v; };
  const load = async () => {
    out.dataset.state = "loading"; out.textContent = "Loading…";
    if (offline) { out.dataset.state = "error"; out.replaceChildren(h("div", { class: "alert bad", text: "Network error: you are offline." })); return; }
    const r = await api("GET", "/api/products?limit=3", undefined, { auth: false });
    if (!r.ok) { out.dataset.state = "error"; out.replaceChildren(h("div", { class: "alert bad", text: `HTTP ${r.status}` })); return; }
    out.dataset.state = "ok";
    out.replaceChildren(h("ul", { class: "dl-list" }, r.data.data.map((p) => h("li", { "data-testid": "net-product", text: p.name }))));
  };
  const flapBox = check("Flap randomly (offline for 1–3 s)", "net-flap", false, (v) => {
    T.stop(flap);
    if (v) flap = T.every(() => { if (Math.random() < 0.4 && !offline) { setOffline(true); T.after(() => setOffline(false), rand(1000, 3000)); } }, 2000);
  });
  return scenario("offline", "6 · The network drops in and out", "Connectivity flaps for a few seconds at random (Wi-Fi, VPN, CI runners). Practise context.setOffline(), page.route().abort() and retry-friendly UI assertions.",
    h("div", { class: "row", style: { marginBottom: "12px" } }, sw, flapBox, status), h("div", { class: "row", style: { marginBottom: "12px" } }, btn("Load products", "net-load", load, "btn primary")), out);
}

page({
  id: "flaky-network", group: "dynamic", title: "Flaky network & async",
  blurb: "Failing-then-succeeding APIs, race conditions, out-of-order results, late options and flapping connections.",
  tasks: [
    "Call the API with N = 2 and write a retry loop (or expect(...).toPass({ intervals: [250, 500, 1000] })) that is green on attempt 3.",
    "Run the 20-call batch at 30 % and compute the failure ratio; then decide where a retry belongs: the test or the client under test.",
    "Reproduce the race condition by typing “play” with locator.pressSequentially(), find the bug in the arrival log and verify the fix checkbox.",
    "Wait for each panel by name (never by arrival order) with Promise.all of locator.waitFor() calls.",
    "Select “Large” after the options load with locator.selectOption('large') and compare with a Selenium WebDriverWait on option count.",
    "Use context.setOffline(true) and page.route('**/api/products*', r => r.abort()) to assert the offline error state.",
    "Assert data-state on the output box moves idle → loading → ok using expect(locator).toHaveAttribute and expect.poll().",
  ],
  render(root) {
    const T = bag();
    root.append(
      jumpBar([["failfirst", "1 Fail first N"], ["rate", "2 Failure rate"], ["race", "3 Race"], ["order", "4 Order"], ["select", "5 Late select"], ["offline", "6 Offline"]]),
      scFailFirst(), scRate(T), scRace(), scOrder(T), scLateSelect(T), scOffline(T));
    return () => T.clear();
  },
});

// ================================================================ page 3: state, time & environment
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function scTime(T) {
  const clock = h("p", { class: "mono", style: { fontSize: "1.6rem", margin: "0 0 4px" }, "data-testid": "time-clock" });
  const date = h("p", { "data-testid": "time-date" });
  const greet = h("p", { "data-testid": "time-greeting" });
  const next = h("p", { class: "mono", "data-testid": "time-next-minute" });
  const session = h("p", { class: "mono", role: "status", "data-testid": "time-session" });
  const extend = h("button", { class: "btn sm", type: "button", hidden: true, "data-testid": "time-extend" }, "Extend session");
  let end = Date.now() + 30000;
  extend.addEventListener("click", () => { end = Date.now() + 30000; extend.hidden = true; tick(); });
  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString("en-GB");
    date.textContent = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const hr = d.getHours();
    greet.textContent = hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    next.textContent = `Seconds until the next full minute: ${60 - d.getSeconds()}`;
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    session.textContent = left ? `Session expires in 00:${String(left).padStart(2, "0")}` : "Session expired";
    extend.hidden = left > 0;
  };
  tick(); T.every(tick, 1000);
  return scenario("time", "1 · Text that depends on the clock", "Seconds, dates and greetings change by themselves. Tests that hard-code “Good morning”, today’s date or a 30 s session pass only at certain times of day. Use page.clock.install() and setFixedTime().",
    clock, date, greet, next, session, extend);
}

function scState() {
  const visits = store.get("flaky.visits", 0) + 1;
  store.set("flaky.visits", visits);
  const wrap = h("div", { "data-testid": "state-wrap" });
  const info = h("p", { class: "mono", "data-testid": "state-visits" }, `Visit number ${visits} in this browser profile`);
  const draw = () => {
    wrap.replaceChildren();
    if (!store.get("flaky.tour", false)) {
      wrap.append(h("div", { class: "fl-tour", role: "dialog", "aria-label": "Welcome tour", "data-testid": "state-tour" },
        h("b", { text: "Welcome! Take a quick tour." }), h("p", { style: { margin: "6px 0" }, text: "This tour only shows on your very first visit." }),
        btn("Dismiss tour", "state-tour-dismiss", () => { store.set("flaky.tour", true); draw(); }, "btn sm primary")));
    } else wrap.append(h("p", { class: "muted", "data-testid": "state-tour-hidden", text: "Tour already dismissed in an earlier run." }));
  };
  draw();
  return scenario("state", "2 · State that leaks between tests", "A welcome tour shows only on the first visit and a visit counter keeps growing, both stored in localStorage. Test order and a reused browser profile decide whether the test passes.",
    info, wrap, btn("Reset stored state", "state-reset", () => { store.del("flaky.visits"); store.del("flaky.tour"); info.textContent = "Visit number 0 (state reset; reload to start again)"; draw(); }, "btn sm"));
}

function scData() {
  const seed = h("input", { type: "text", "data-testid": "data-seed", placeholder: "empty = truly random", "aria-label": "Seed", style: { width: "180px" } });
  const o = { name: h("b", { "data-testid": "data-out-name", text: "—" }), email: h("span", { class: "mono", "data-testid": "data-out-email", text: "—" }), id: h("span", { class: "mono", "data-testid": "data-out-id", text: "—" }), age: h("span", { "data-testid": "data-out-age", text: "—" }) };
  const FIRST = ["Asha", "Liam", "Mei", "Omar", "Sofia", "Ken", "Priya", "Lucas"], LAST = ["Verma", "Carter", "Tanaka", "Haddad", "Rossi", "Adeyemi", "Nair", "Meyer"];
  const gen = () => {
    const s = seed.value.trim();
    let n = 0; for (const c of s) n = (n * 31 + c.charCodeAt(0)) >>> 0;
    const r = s ? mulberry(n) : Math.random;
    const f = FIRST[Math.floor(r() * FIRST.length)], l = LAST[Math.floor(r() * LAST.length)], num = Math.floor(r() * 900) + 100;
    o.name.textContent = `${f} ${l}`; o.email.textContent = `${f}.${l}${num}@example.test`.toLowerCase(); o.id.textContent = "U-" + (s ? num.toString(36) : Date.now().toString(36)); o.age.textContent = String(Math.floor(r() * 50) + 18);
  };
  return scenario("data", "3 · Random test data", "Names, e-mails and ids differ on every run. An assertion on an exact value is flaky; assert the pattern, or seed the generator (type a seed to make it repeatable).",
    h("div", { class: "row" }, field("Seed", seed), btn("Generate user", "data-generate", gen, "btn primary")),
    h("div", { class: "stack" }, h("div", {}, "Name: ", o.name), h("div", {}, "E-mail: ", o.email), h("div", {}, "Id: ", o.id), h("div", {}, "Age: ", o.age)));
}

function scViewport(T) {
  const width = h("p", { class: "mono", "data-testid": "vp-width" });
  const full = h("div", { class: "row", "data-testid": "vp-full-nav" }, ["Home", "Products", "Pricing", "Docs"].map((x) => h("a", { class: "btn sm", href: "/practice/flaky-state-time", onClick: (e) => e.preventDefault(), "data-testid": "vp-link-" + x.toLowerCase() }, x)));
  const burger = h("button", { class: "btn", type: "button", "data-testid": "vp-hamburger", "aria-label": "Open menu" }, "☰ Menu");
  const upd = () => { const small = window.innerWidth <= 900; full.hidden = small; burger.hidden = !small; width.textContent = `Viewport width: ${window.innerWidth} px (breakpoint 900 px)`; };
  window.addEventListener("resize", upd); upd();
  T.cleanups.push(() => window.removeEventListener("resize", upd));
  return scenario("viewport", "4 · Layout that depends on the viewport", "Below 900 px the navigation links are replaced by a hamburger button. A laptop run and a CI run with another default viewport see different elements. Pin viewport in the config.",
    width, h("div", { style: { minHeight: "44px" } }, full, burger));
}

function scFormat() {
  const sel = h("select", { "data-testid": "fmt-locale", "aria-label": "Locale", style: { width: "auto" } },
    ["", "en-US", "en-GB", "de-DE", "fr-FR", "en-IN", "ja-JP", "ar-EG"].map((l) => h("option", { value: l, text: l || "Browser default" })));
  const detected = h("p", { class: "hint", "data-testid": "fmt-detected" });
  const num = h("p", { class: "mono", style: { fontSize: "1.2rem" }, "data-testid": "fmt-number" });
  const dt = h("p", { class: "mono", "data-testid": "fmt-date" });
  const draw = () => {
    const loc = sel.value || undefined;
    detected.textContent = "navigator.language = " + navigator.language + " · time zone = " + Intl.DateTimeFormat().resolvedOptions().timeZone;
    num.textContent = new Intl.NumberFormat(loc, { style: "currency", currency: "USD" }).format(1234567.891);
    dt.textContent = new Intl.DateTimeFormat(loc, { dateStyle: "full", timeStyle: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 2, 8, 13, 5)));
  };
  sel.addEventListener("change", draw); draw();
  return scenario("format", "5 · Number and date formats follow the locale", "“$1,234,567.89” on your laptop is “1.234.567,89 $” on a German runner. Set locale and timezoneId in the Playwright config instead of trusting the machine.",
    field("Locale", sel), detected, num, dt);
}

function scAnim(T) {
  const panel = h("div", { class: "fl-fade", "data-testid": "anim-panel" }, "I fade in over 0.8 seconds.");
  const op = h("p", { class: "mono", "data-testid": "anim-opacity" }, "Computed opacity: 0");
  let raf = 0;
  const watch = () => { op.textContent = "Computed opacity: " + Number(getComputedStyle(panel).opacity).toFixed(2); raf = requestAnimationFrame(watch); };
  watch(); T.cleanups.push(() => cancelAnimationFrame(raf));
  return scenario("anim", "6 · A transition that is still running", "The panel is “visible” (opacity > 0) long before it is fully opaque. Screenshots and toHaveCSS('opacity', '1') taken too early differ per run. Try page.emulateMedia({ reducedMotion: 'reduce' }).",
    h("div", { class: "row", style: { marginBottom: "12px" } }, btn("Fade the panel in", "anim-btn", () => panel.classList.add("on"), "btn primary"), btn("Reset", "anim-reset", () => panel.classList.remove("on"), "btn sm")), panel, op);
}

page({
  id: "flaky-state-time", group: "dynamic", title: "Flaky state & time",
  blurb: "Clock-dependent text, leaking storage, random data, viewport and locale differences and slow transitions.",
  tasks: [
    "Freeze the clock with await page.clock.install({ time: new Date('2026-03-08T09:30:00') }) and assert “Good morning” deterministically.",
    "Fast-forward the session countdown with page.clock.fastForward(30000) and assert the “Extend session” button appears.",
    "Make the welcome-tour test order-independent: fresh browser context per test, or storageState with the tour already dismissed.",
    "Assert the generated e-mail with a regex (/^[a-z]+\\.[a-z]+\\d{3}@example\\.test$/) and then repeat with a seed for an exact match.",
    "Run the viewport test at 1280×720 and at 390×844 with page.setViewportSize() and assert the right navigation element each time.",
    "Pin locale: 'en-US' and timezoneId: 'UTC' in playwright.config and assert the formatted currency and date.",
    "Wait for the transition with expect(panel).toHaveCSS('opacity', '1') (retrying), then compare with a fixed sleep.",
  ],
  render(root) {
    const T = bag(); T.cleanups = [];
    root.append(
      jumpBar([["time", "1 Time"], ["state", "2 State"], ["data", "3 Data"], ["viewport", "4 Viewport"], ["format", "5 Locale"], ["anim", "6 Transition"]]),
      scTime(T), scState(), scData(), scViewport(T), scFormat(), scAnim(T));
    return () => { T.clear(); T.cleanups.forEach((f) => f()); };
  },
});

// ================================================================ page 4: diagnosis & strategy
const P_FAIL = 0.35;
const SIMS = [
  { id: "late", label: "Button becomes enabled after a random 0.5–4 s", strategies: [
    ["sleep2", "Fixed sleep 2 s, then click", () => ({ pass: rand(500, 4000) <= 2000, ms: 2000 })],
    ["sleep5", "Fixed sleep 5 s, then click", () => ({ pass: true, ms: 5000 })],
    ["auto5", "Auto-wait (5 s timeout)", () => { const t = rand(500, 4000); return { pass: true, ms: t }; }],
    ["auto1", "Auto-wait with a 1 s timeout", () => { const t = rand(500, 4000); return { pass: t <= 1000, ms: Math.min(t, 1000) }; }],
  ] },
  { id: "api", label: `API call fails ${P_FAIL * 100} % of the time`, strategies: [
    ["single", "Single attempt", () => ({ pass: Math.random() >= P_FAIL, ms: 300 })],
    ["retry3", "Retry up to 3 attempts", () => { let n = 0, ok = false; while (n < 3 && !ok) { n++; ok = Math.random() >= P_FAIL; } return { pass: ok, ms: n * 300 }; }],
    ["retry5", "Retry 5 attempts, back-off 0.2 → 1.6 s", () => { let n = 0, ok = false, ms = 0; while (n < 5 && !ok) { ms += 300; n++; ok = Math.random() >= P_FAIL; if (!ok) ms += 200 * 2 ** (n - 1); } return { pass: ok, ms }; }],
    ["rerun", "Re-run the whole test (retries: 2)", () => { let n = 0, ok = false; while (n < 3 && !ok) { n++; ok = Math.random() >= P_FAIL; } return { pass: ok, ms: n * 4000 }; }],
  ] },
  { id: "overlay", label: "An overlay covers the button 30 % of the time (0.5–2.5 s)", strategies: [
    ["now", "Click immediately (no actionability checks)", () => ({ pass: Math.random() >= 0.3, ms: 100 })],
    ["force", "Click with force: true", () => ({ pass: Math.random() >= 0.3, ms: 100 })],
    ["auto", "Auto-wait until the button receives events", () => { const covered = Math.random() < 0.3; return { pass: true, ms: 100 + (covered ? rand(500, 2500) : 0) }; }],
  ] },
  { id: "race", label: "Type-ahead whose responses arrive out of order", strategies: [
    ["last", "Last response wins (the bug)", () => ({ pass: raceLastIsNewest(), ms: 1000 })],
    ["sleep", "Last response wins + sleep 1.5 s before asserting", () => ({ pass: raceLastIsNewest(), ms: 2500 })],
    ["guard", "Ignore stale responses (sequence guard)", () => ({ pass: true, ms: 1000 })],
    ["debounce", "Debounce input 300 ms (one request)", () => ({ pass: true, ms: 1300 })],
  ] },
  { id: "stale", label: "Element re-rendered every second; the test does other work after finding it", strategies: [
    ["cached", "Cache the element handle, then click", () => ({ pass: Math.floor((rand(0, 999) + rand(50, 1500)) / 1000) === 0, ms: 200 })],
    ["retry", "Catch the stale error and retry (3 attempts)", () => { let n = 0, ok = false; while (n < 3 && !ok) { n++; ok = Math.floor((rand(0, 999) + rand(50, 1500)) / 1000) === 0; } return { pass: ok, ms: n * 250 }; }],
    ["locator", "Re-query on every action (lazy locator)", () => ({ pass: true, ms: 200 })],
  ] },
];
function raceLastIsNewest() {
  const arrivals = [0, 100, 200].map((t, i) => t + [950, 700, 450][i] + rand(-500, 500));
  return arrivals.indexOf(Math.max(...arrivals)) === 2;
}

const CAUSES = [
  ["Fixed sleeps and tight timeouts", "Green on a fast laptop, red on a busy CI runner", "Auto-waiting actions and web-first assertions; locator.waitFor()", "WebDriverWait + expected_conditions, never time.sleep()", "flaky-lab"],
  ["Stale element references", "“element is not attached”, StaleElementReferenceException", "Locators are lazy and re-resolve on every action", "Re-find the element or wrap the action in a retrying helper", "flaky-lab"],
  ["Overlays, animations, moving targets", "“intercepts pointer events”, “element is not stable”", "Assert the overlay is hidden; never force: true to hide a real problem", "Wait for invisibility_of_element_located, then click", "flaky-lab"],
  ["Race conditions in the app", "Wrong data shown now and then, retry makes it pass", "Wait for the exact response (waitForResponse) and report the product bug", "Poll the DOM for the specific value", "flaky-network"],
  ["Unreliable network or third parties", "Timeouts, 5xx, flapping connectivity", "page.route() to mock and stub; retry only API-level calls", "A mock server or proxy such as WireMock", "flaky-network"],
  ["Shared and leaking state", "Passes alone, fails in the full suite or in another order", "Fresh BrowserContext per test, unique data, X-Sandbox per worker", "New driver or cleared cookies and storage per test", "flaky-state-time"],
  ["Time and date dependence", "Fails at midnight, month end or after a DST change", "page.clock.install() and setFixedTime()", "Inject a fixed clock or build data relative to now", "flaky-state-time"],
  ["Environment differences", "Different viewport, locale, fonts or timezone on CI", "Pin viewport, locale and timezoneId in playwright.config", "Set window size and ChromeOptions language explicitly", "flaky-state-time"],
  ["Random content (A/B tests, banners, popups)", "Element sometimes missing or covered", "Force variants via URL or cookie; page.addLocatorHandler()", "Disable experiments in test environments", "flaky-lab"],
  ["Data collisions in parallel runs", "Unique-constraint errors, wrong row counts", "Per-worker data (testInfo.workerIndex) and isolated sandboxes", "Generate unique data with a prefix per thread", "flaky-network"],
];

const CHECKLIST = [
  "Reproduce first: npx playwright test --repeat-each=30 --workers=4 (a flake you cannot reproduce is a guess).",
  "Open the trace (trace: 'retain-on-failure') and read the failing action’s call log and network tab.",
  "Delete every fixed sleep and waitForTimeout; replace them with web-first assertions or locator.waitFor().",
  "Make each test own its data: unique values, a fresh context and an isolated sandbox (X-Sandbox).",
  "Fix actionability problems instead of forcing clicks: wait for overlays and animations to end.",
  "Stub or mock slow and third-party calls with page.route(); keep one real end-to-end smoke test.",
  "Freeze time with page.clock and pin viewport, locale and timezone in the config.",
  "Use retries only on CI (retries: 2) and treat every test reported as “flaky” as a bug with an owner.",
  "Quarantine with test.fixme() or a @flaky tag plus a ticket and a deadline; never leave it silently skipped.",
  "Track the flake rate weekly (flaky ÷ total) and fail the build when it crosses an agreed threshold.",
];

const SNIPPETS = [
  ["Retry an assertion block until it passes", `await expect(async () => {
  const res = await page.request.get("/api/flaky?failRate=0.3");
  expect(res.status()).toBe(200);
}).toPass({ intervals: [250, 500, 1000], timeout: 10_000 });`],
  ["Poll any value with expect.poll", `await expect.poll(async () => {
  const res = await request.get("/api/jobs/" + id);
  return (await res.json()).data.status;
}, { timeout: 15_000 }).toBe("done");`],
  ["Config: retries, trace and repeat-each friendly settings", `export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  use: { trace: "retain-on-failure", viewport: { width: 1280, height: 720 }, locale: "en-US", timezoneId: "UTC" },
  reporter: [["html", { open: "never" }], ["list"]],
});`],
];

function sim(root) {
  const scn = h("select", { "data-testid": "run-scenario", "aria-label": "Scenario" }, SIMS.map((s) => h("option", { value: s.id, text: s.label })));
  const str = h("select", { "data-testid": "run-strategy", "aria-label": "Strategy" });
  const runs = h("input", { type: "number", min: "1", max: "500", value: "100", "data-testid": "run-count", "aria-label": "Number of runs", style: { width: "110px" } });
  const out = h("div", { role: "status", "data-testid": "run-result" }, "Choose a scenario and a strategy, then run it.");
  const grid = h("div", { class: "fl-grid", "data-testid": "run-grid" });
  const fill = () => { const s = SIMS.find((x) => x.id === scn.value); str.replaceChildren(...s.strategies.map(([id, label]) => h("option", { value: id, text: label }))); };
  scn.addEventListener("change", fill); fill();
  const go = () => {
    const s = SIMS.find((x) => x.id === scn.value), run = s.strategies.find((x) => x[0] === str.value)[2];
    const n = Math.min(500, Math.max(1, Math.floor(Number(runs.value)) || 1));
    let pass = 0, ms = 0; const dots = [];
    for (let i = 0; i < n; i++) { const r = run(); if (r.pass) pass++; ms += r.ms; if (i < 200) dots.push(h("i", { class: "fl-dot" + (r.pass ? "" : " bad"), title: `Run ${i + 1}: ${r.pass ? "pass" : "fail"}` })); }
    const rate = pass / n, pct = Math.round(rate * 1000) / 10;
    const verdict = n < 2 ? "Run it more than once to see flakiness." : rate === 1 ? "Stable: no failures in this batch." : rate === 0 ? "Always fails: a real bug or a broken test, not a flaky one." : `Flaky: it passes ${pct} % of the time.`;
    grid.replaceChildren(...dots);
    out.replaceChildren(
      h("div", { class: "alert " + (rate === 1 ? "ok" : rate === 0 ? "bad" : "warn"), "data-testid": "run-verdict", text: verdict }),
      h("p", { class: "mono", style: { margin: "10px 0 0" } },
        h("span", { "data-testid": "run-pass", text: `Passed: ${pass}` }), " · ", h("span", { "data-testid": "run-fail", text: `Failed: ${n - pass}` }), " · ",
        h("span", { "data-testid": "run-rate", text: `Pass rate: ${pct} %` }), " · ", h("span", { "data-testid": "run-avg", text: `Average duration: ${Math.round(ms / n)} ms` })),
      h("p", { class: "hint", "data-testid": "run-suite", text: `Chance that 20 CI runs in a row are all green: ${(rate ** 20 * 100).toFixed(1)} %` }));
  };
  root.append(stage(h("h2", { text: "Run it N times" }),
    h("p", { class: "muted", text: "A simulation with virtual time: pick a flake and a strategy and see how often a test using it passes. Each square is one run (green pass, red fail, first 200 shown)." }),
    h("div", { class: "grid g2" }, field("Scenario", scn), field("Strategy", str)),
    h("div", { class: "row" }, field("Runs", runs), btn("Run simulation", "run-go", go, "btn primary")), h("div", { class: "result" }, out), grid));
}

function checklist(root) {
  const done = new Set(store.get("flakyChecklist", []));
  const prog = h("p", { class: "mono", role: "status", "data-testid": "chk-progress" });
  const upd = () => (prog.textContent = `${done.size} of ${CHECKLIST.length} steps done`);
  const items = CHECKLIST.map((t, i) => h("li", { style: { listStyle: "none", marginBottom: "6px" } }, check(t, "chk-" + (i + 1), done.has(i), (v) => { v ? done.add(i) : done.delete(i); store.set("flakyChecklist", [...done]); upd(); })));
  upd();
  root.append(stage(h("h2", { text: "Retry & quarantine checklist" }), prog, h("ul", { style: { padding: 0, margin: 0 }, "data-testid": "chk-list" }, items)));
}

page({
  id: "flaky-diagnosis", group: "dynamic", title: "Flaky root causes & retries",
  blurb: "Why tests flake, how to fix each cause, a retry and quarantine checklist and a run-it-N-times simulator.",
  tasks: [
    "Pick “Fixed sleep 2 s” and run 200 times; then compare with auto-wait: note both the pass rate and the average duration.",
    "Explain why the “last response wins” race still fails after adding a sleep, and which strategy actually removes the flake.",
    "Compute the chance that a suite of 20 independent tests, each 98 % reliable, is green; compare with the simulator’s suite estimate.",
    "Work through the checklist on your own project and write down which step you skipped.",
    "Add retries: 2 to playwright.config, run a flaky spec and find the “flaky” label in the HTML report.",
    "Use test.fixme() to quarantine one scenario from the lab pages and link it to a ticket id in the title.",
  ],
  render(root) {
    const table = h("table", { "data-testid": "causes-table" },
      h("thead", {}, h("tr", {}, ["Root cause", "Symptom", "Playwright fix", "Selenium fix", "Practise it"].map((c) => h("th", { text: c })))),
      h("tbody", {}, CAUSES.map(([c, s, p, se, link]) => h("tr", {}, ...[c, s, p, se].map((x, i) => h("td", { style: { whiteSpace: "normal", minWidth: "170px", fontWeight: i === 0 ? 600 : 400 }, text: x })), h("td", {}, h("a", { href: "/practice/" + link, "data-testid": "cause-link-" + link }, link))))));
    root.append(stage(h("h2", { text: "Ten root causes of flaky tests" }), h("div", { class: "tbl-wrap" }, table)));
    sim(root);
    checklist(root);
    root.append(stage(h("h2", { text: "Code you will reuse" }), ...SNIPPETS.map(([t, c]) => h("div", { style: { marginBottom: "14px" } }, h("b", { class: "mono", text: t }), h("pre", { style: { marginTop: "6px" }, text: c })))));
  },
});
