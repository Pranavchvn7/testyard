import { page } from "../registry.js";
import { h, $, $$, toast, stage, field, sleep, rand, pick, shuffle, api } from "../ui.js";

// ---------------------------------------------------------------- dynamic controls
page({
  id: "dynamic-controls", group: "dynamic", title: "Dynamic controls",
  blurb: "Elements that are removed, added, enabled and disabled asynchronously after a server-like delay.",
  tasks: ["Remove the checkbox and wait for the “It’s gone!” message.", "Enable the text input and type into it once enabled.", "Never use sleep(): use auto-waiting or explicit waits.", "Assert the loader appears and disappears."],
  render(root) {
    const loader = h("span", { class: "spinner", hidden: true, "data-testid": "loader", role: "progressbar", "aria-label": "Loading" });
    const msg = h("p", { role: "status", "data-testid": "dc-msg", class: "mono" });
    const holder = h("div", { "data-testid": "cb-holder" });
    const mkCb = () => h("label", { class: "check", id: "cb-wrap" }, h("input", { type: "checkbox", id: "dyn-cb", "data-testid": "dyn-checkbox" }), "A checkbox");
    holder.append(mkCb());
    const rm = h("button", { class: "btn", type: "button", "data-testid": "toggle-checkbox" }, "Remove");
    rm.addEventListener("click", async () => {
      rm.disabled = true; loader.hidden = false; msg.textContent = ""; await sleep(2000);
      const removing = rm.textContent === "Remove";
      holder.replaceChildren(...(removing ? [] : [mkCb()])); rm.textContent = removing ? "Add" : "Remove"; msg.textContent = removing ? "It's gone!" : "It's back!";
      loader.hidden = true; rm.disabled = false;
    });
    const inp = h("input", { type: "text", disabled: true, id: "dyn-input", "data-testid": "dyn-input", placeholder: "I'm disabled" });
    const en = h("button", { class: "btn", type: "button", "data-testid": "toggle-input" }, "Enable");
    en.addEventListener("click", async () => {
      en.disabled = true; loader.hidden = false; msg.textContent = ""; await sleep(2000);
      inp.disabled = !inp.disabled; en.textContent = inp.disabled ? "Enable" : "Disable"; inp.placeholder = inp.disabled ? "I'm disabled" : "I'm enabled";
      msg.textContent = inp.disabled ? "It's disabled!" : "It's enabled!"; loader.hidden = true; en.disabled = false;
    });
    root.append(h("div", { class: "grid g2" }, stage(h("h2", { text: "Checkbox" }), holder, h("div", { class: "row" }, rm)), stage(h("h2", { text: "Input" }), inp, h("div", { class: "row", style: { marginTop: "10px" } }, en))), stage(loader, msg));
  },
});

// ---------------------------------------------------------------- dynamic loading
page({
  id: "dynamic-loading", group: "dynamic", title: "Dynamic loading",
  blurb: "Content that is hidden in the DOM, or not rendered at all, until a slow operation finishes.",
  tasks: ["Example 1: the heading exists but is hidden — wait for visible.", "Example 2: the heading does not exist until loaded — wait for attached.", "Pick a custom delay and assert the total wait is close to it.", "Use the API-backed example to wait on a network response."],
  render(root) {
    const mk = (mode) => {
      const wrap = h("div", { "data-testid": "load-" + mode });
      const fin = h("h3", { id: "finish-" + mode, "data-testid": "finish-" + mode, text: "Hello World!" });
      if (mode === "hidden") fin.style.display = "none";
      const spin = h("div", { class: "spinner", hidden: true, "data-testid": "spinner-" + mode });
      const btn = h("button", { class: "btn primary", type: "button", "data-testid": "start-" + mode, onClick: async () => { btn.hidden = true; spin.hidden = false; await sleep(2500); spin.hidden = true; if (mode === "hidden") fin.style.display = ""; else wrap.append(fin); } }, "Start");
      wrap.append(btn, spin); if (mode === "hidden") wrap.append(fin);
      return wrap;
    };
    const delay = h("input", { type: "number", value: "3000", min: "0", max: "10000", "data-testid": "api-delay", style: { width: "120px" } });
    const apiOut = h("pre", { "data-testid": "api-load-out" }, "—");
    root.append(h("div", { class: "grid g2" }, stage(h("h2", { text: "1 · Hidden element" }), mk("hidden")), stage(h("h2", { text: "2 · Rendered after" }), mk("rendered"))),
      stage(h("h2", { text: "3 · Wait for an API" }), h("div", { class: "row" }, delay, h("button", { class: "btn primary", type: "button", "data-testid": "api-load", onClick: async () => { apiOut.textContent = "Loading…"; const r = await api("GET", "/api/delay/" + (+delay.value || 0), undefined, { auth: false }); apiOut.textContent = `HTTP ${r.status} after ${r.ms} ms\n` + JSON.stringify(r.data, null, 2); } }, "Call /api/delay")), h("div", { class: "result" }, apiOut)));
  },
});

// ---------------------------------------------------------------- flaky
page({
  id: "flaky", group: "dynamic", title: "Flaky behaviour",
  blurb: "A button that sometimes fails, an element that re-renders under your feet and a stale-element trap.",
  tasks: ["Set failure rate to 50% and write a retry that makes the test pass reliably.", "Keep a reference to the re-rendering button and handle the stale element.", "Hit the flaky API endpoint 20 times and compute the failure ratio.", "Decide: should you retry the test or fix the cause?"],
  render(root) {
    let rate = 50, ok = 0, bad = 0;
    const stats = h("p", { class: "mono", "data-testid": "flaky-stats", text: "Passed 0 · Failed 0" });
    const slider = h("input", { type: "range", min: "0", max: "100", value: "50", "data-testid": "fail-rate", "aria-label": "Failure rate" }), lab = h("span", { class: "tag acc", "data-testid": "fail-rate-out", text: "50%" });
    slider.addEventListener("input", () => { rate = +slider.value; lab.textContent = rate + "%"; });
    const out = h("div", { role: "status", "data-testid": "flaky-out" });
    const call = h("button", { class: "btn primary", type: "button", "data-testid": "flaky-call", onClick: async () => { const r = await api("GET", `/api/flaky?failRate=${rate / 100}`, undefined, { auth: false }); r.ok ? ok++ : bad++; out.replaceChildren(h("div", { class: "alert " + (r.ok ? "ok" : "bad"), text: `HTTP ${r.status}: ${r.data.message}` })); stats.textContent = `Passed ${ok} · Failed ${bad}`; } }, "Call flaky API");
    const stale = h("div", { "data-testid": "stale-host" });
    let clicks = 0;
    const mkBtn = () => h("button", { class: "btn", type: "button", "data-testid": "stale-btn", onClick: () => { clicks++; sc.textContent = "Clicks that landed: " + clicks; } }, "Click me (I re-render)");
    const sc = h("p", { class: "mono", "data-testid": "stale-count", text: "Clicks that landed: 0" });
    stale.append(mkBtn());
    const iv = setInterval(() => stale.replaceChildren(mkBtn()), 1500);
    root.append(h("div", { class: "grid g2" }, stage(h("h2", { text: "Flaky API" }), h("div", { class: "row", style: { flexWrap: "nowrap" } }, slider, lab), h("div", { class: "row", style: { margin: "12px 0" } }, call), out, stats), stage(h("h2", { text: "Stale element" }), stale, sc, h("p", { class: "hint", text: "The button is replaced every 1.5 s." }))));
    return () => clearInterval(iv);
  },
});

// ---------------------------------------------------------------- slow resources
page({
  id: "slow", group: "dynamic", title: "Slow resources",
  blurb: "Images and API calls with a configurable delay. Practise timeouts, spinners and network interception.",
  tasks: ["Wait for the slow image to finish loading before asserting its size.", "Mock the slow route and make it instant.", "Assert the loading skeleton shows first.", "Trigger a timeout by setting a delay longer than your test timeout."],
  render(root) {
    const BASE = (window.TESTYARD_API_BASE || "").replace(/\/$/, "");
    const ms = h("select", { "data-testid": "img-delay", style: { width: "auto" } }, [1000, 3000, 6000].map((v) => h("option", { value: v, text: v / 1000 + " s" })));
    const imgHost = h("div", { "data-testid": "img-host", style: { minHeight: "140px" } });
    const state = h("p", { class: "mono", "data-testid": "img-state", text: "Idle" });
    const load = () => {
      const img = h("img", { alt: "slow image", width: 320, height: 140, "data-testid": "slow-img", src: `${BASE}/api/slow-image?ms=${ms.value}&t=${Date.now()}` });
      state.textContent = "Loading…"; imgHost.replaceChildren(h("div", { class: "spinner", "data-testid": "img-spinner" }));
      img.addEventListener("load", () => { state.textContent = "Loaded ✔"; imgHost.replaceChildren(img); });
      img.addEventListener("error", () => { state.textContent = "Failed to load"; imgHost.replaceChildren(); });
      const pre = new Image(); pre.onload = () => img.dispatchEvent(new Event("load")); pre.onerror = () => img.dispatchEvent(new Event("error")); pre.src = img.src;
    };
    root.append(stage(h("div", { class: "row" }, h("label", { for: "x", class: "label", text: "Delay" }), ms, h("button", { class: "btn primary", type: "button", "data-testid": "load-img", onClick: load }, "Load image")), h("div", { style: { margin: "14px 0" } }, imgHost), state));
  },
});

// ---------------------------------------------------------------- unstable UI
page({
  id: "unstable", group: "dynamic", title: "Unstable UI",
  blurb: "Layout shifts, random typos, disappearing menu items and a button whose label changes every load.",
  tasks: ["Click the Gallery link even though it sometimes vanishes.", "Detect the typo in the paragraph and report the exact text.", "Assert the shifting button position tolerance (±px).", "Handle the random label by using a stable attribute."],
  render(root) {
    const items = ["Home", "About", "Portfolio", "Contact us", "Gallery"];
    const nav = h("div", { class: "row", "data-testid": "flaky-menu" });
    const draw = () => nav.replaceChildren(...items.filter((i) => i !== "Gallery" || Math.random() > 0.4).map((i) => h("a", { class: "btn sm", href: "/practice/unstable", onClick: (e) => { e.preventDefault(); toast(i + " clicked", "ok", 1200); }, "data-testid": "m-" + i.toLowerCase().replace(/\W+/g, "-") }, i)));
    draw();
    const sentences = ["Sometimes you see a typo, sometimes you don't.", "Just refresh the page to see the other one."];
    const typo = Math.random() > 0.5 ? sentences[0].replace("Sometimes", "Sometimes".replace("o", "ou")) : sentences[0];
    const shifted = h("button", { class: "btn primary", type: "button", "data-testid": "shifter", style: { marginLeft: rand(0, 40) + "px", marginTop: rand(0, 14) + "px" } }, "I shift a little");
    const label = pick(["Buy now", "Add to cart", "Get it", "Order"]);
    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Disappearing elements" }), nav, h("div", { style: { marginTop: "12px" } }, h("button", { class: "btn", type: "button", "data-testid": "reshuffle", onClick: draw }, "Reload menu"))),
      stage(h("h2", { text: "Typos" }), h("p", { "data-testid": "typo-text", text: typo + " " + sentences[1] })),
      stage(h("h2", { text: "Shifting content" }), shifted, h("p", { class: "hint", text: "Offsets are randomised on every visit." })),
      stage(h("h2", { text: "Random label" }), h("button", { class: "btn", type: "button", id: "cta", "data-testid": "random-label", "data-role": "cta" }, label))));
  },
});

// ---------------------------------------------------------------- dynamic IDs
page({
  id: "dynamic-id", group: "dom", title: "Dynamic IDs & classes",
  blurb: "Every render generates new ids and class names. Learn selectors that survive: text, role, data attributes and structure.",
  tasks: ["Reload and show the id of the button changed.", "Click it using getByRole and a stable data attribute.", "Write an XPath that ignores the random suffix (starts-with).", "Explain why recording tools break here."],
  render(root) {
    const sfx = () => Math.random().toString(36).slice(2, 8);
    const out = h("p", { class: "mono", "data-testid": "dyn-out", text: "Clicks: 0" });
    let n = 0;
    const host = h("div", { class: "row" });
    const draw = () => {
      const id = "btn_" + sfx(), cls = "c-" + sfx();
      host.replaceChildren(h("button", { id, class: "btn primary " + cls, type: "button", "data-qa": "dynamic-button", onClick: () => (out.textContent = "Clicks: " + ++n) }, "Dynamic button"), h("code", { "data-testid": "current-id", text: "id=" + id }));
    };
    draw();
    root.append(stage(host, out, h("div", { class: "row", style: { marginTop: "12px" } }, h("button", { class: "btn", type: "button", "data-testid": "regen", onClick: draw }, "Regenerate ids"))));
  },
});

// ---------------------------------------------------------------- challenging DOM
page({
  id: "challenging-dom", group: "dom", title: "Challenging DOM",
  blurb: "Three buttons that swap ids, a table whose cells must be found by neighbours, and a canvas with random text.",
  tasks: ["Click the button whose text currently equals “foo” (it changes).", "Edit the row where Lorem equals the value from column 1.", "Read the text drawn on the canvas (hint: you can’t in the DOM).", "Find the red button regardless of its position."],
  render(root) {
    const labels = shuffle(["foo", "bar", "baz"]);
    const cls = shuffle(["", "alert", "success"]);
    const answer = h("canvas", { width: 220, height: 50, "data-testid": "answer-canvas", role: "img", "aria-label": "Answer canvas" });
    const draw = () => { const c = answer.getContext("2d"); c.clearRect(0, 0, 220, 50); c.fillStyle = "#e8481c"; c.font = "bold 26px monospace"; c.fillText("Answer: " + rand(10000, 99999), 8, 34); };
    draw();
    const bs = labels.map((l, i) => h("button", { class: "btn " + (cls[i] === "alert" ? "danger" : cls[i] === "success" ? "primary" : ""), type: "button", id: "ch-" + Math.random().toString(36).slice(2, 7), "data-testid": "ch-" + l, onClick: () => { const nl = shuffle(["foo", "bar", "baz"]); $$(".ch-btn", root).forEach((b, k) => { b.textContent = nl[k]; b.id = "ch-" + Math.random().toString(36).slice(2, 7); }); draw(); } }, l));
    bs.forEach((b) => b.classList.add("ch-btn"));
    const rows = Array.from({ length: 8 }, (_, i) => h("tr", {}, ["Iuvaret", "Apeirian", "Adipisci", "Definiebas", "Consequuntur", "Phaedrum"].slice(0, 3).map((x) => h("td", { text: x + i })), h("td", {}, h("a", { href: "/practice/challenging-dom", onClick: (e) => { e.preventDefault(); toast("edit " + i, "info", 1000); } }, "edit"), " ", h("a", { href: "/practice/challenging-dom", onClick: (e) => { e.preventDefault(); toast("delete " + i, "info", 1000); } }, "delete"))));
    root.append(stage(h("div", { class: "row" }, bs), h("div", { style: { margin: "16px 0" } }, answer), h("div", { class: "tbl-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Lorem", "Ipsum", "Dolor", "Action"].map((t) => h("th", { text: t })))), h("tbody", {}, rows)))));
  },
});

// ---------------------------------------------------------------- deep DOM
page({
  id: "deep-dom", group: "dom", title: "Large & deep DOM",
  blurb: "A 50 × 50 table (2 500 cells) and a 40-level nested tree — stress for selectors and performance.",
  tasks: ["Find the cell with id “cell-37-12” and read its value.", "Reach the innermost element and read its text with a short selector.", "Compare locator speed: id vs deep CSS vs absolute XPath.", "Assert the number of td elements equals 2500."],
  render(root) {
    const tbl = h("table", { id: "big-table", "data-testid": "big-table" }, h("tbody", {}, Array.from({ length: 50 }, (_, r) => h("tr", { id: "row-" + (r + 1) }, Array.from({ length: 50 }, (_, c) => h("td", { id: `cell-${r + 1}-${c + 1}`, text: `${r + 1}.${c + 1}` }))))));
    let node = h("span", { id: "deepest", "data-testid": "deepest", text: "I am 40 levels deep" });
    for (let i = 40; i >= 1; i--) node = h("div", { class: "lvl-" + i, style: { paddingLeft: "3px", borderLeft: "1px solid var(--line)" } }, node);
    root.append(stage(h("h2", { text: "Deep tree" }), h("div", { class: "scroll-box", style: { height: "140px" } }, node)), stage(h("h2", { text: "Large table" }), h("div", { class: "scroll-box", style: { height: "320px", padding: 0 } }, tbl)));
  },
});

// ---------------------------------------------------------------- locator playground
page({
  id: "locators", group: "dom", title: "Locator playground",
  blurb: "One compact page full of attribute variety: ids, names, classes, ARIA, data-testid, text, nested lists and siblings.",
  tasks: ["Locate the same “Sign in” button 8 ways: id, name, CSS, XPath, role, text, testid, label.", "Select the 3rd item of the nested list with nth-child and with text.", "Find the input next to the label “Username” via following-sibling.", "Pick the single enabled radio with a CSS :not selector."],
  render(root) {
    root.append(stage(
      h("form", { id: "login-form", class: "login form-main", "data-testid": "locator-form", onSubmit: (e) => { e.preventDefault(); toast("Signed in (practice)", "ok"); } },
        h("div", { class: "grid g2" },
          h("div", { class: "field" }, h("label", { for: "username", text: "Username" }), h("input", { id: "username", name: "user_name", type: "text", class: "input primary-input", placeholder: "Enter username", "data-testid": "username" })),
          h("div", { class: "field" }, h("label", { for: "pwd", text: "Password" }), h("input", { id: "pwd", name: "pass", type: "password", class: "input", "aria-label": "Password field" }))),
        h("button", { id: "signin", name: "signin", class: "btn primary submit-btn", type: "submit", "data-testid": "signin", "aria-label": "Sign in" }, "Sign in")),
      h("hr"),
      h("div", { class: "grid g2" },
        h("ul", { id: "menu-list", class: "nested", "data-testid": "nested" }, h("li", { text: "One" }), h("li", { text: "Two" }), h("li", {}, "Three", h("ul", {}, h("li", { text: "Three-A" }), h("li", { text: "Three-B", class: "target" }))), h("li", { text: "Four" })),
        h("div", { role: "radiogroup" }, ["Alpha", "Beta", "Gamma"].map((x, i) => h("label", { class: "check" }, h("input", { type: "radio", name: "grp", value: x, disabled: i !== 1 }), x))))));
  },
});
