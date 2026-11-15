import { page } from "../registry.js";
import { h, $, $$, copy, store, toast } from "../ui.js";
import { evaluate, describeNode, suggest } from "../locator-engine.js";
import { CATEGORIES, scenarios } from "./locator-scenarios.js";

const FRAME_CSS = "body{font:14px/1.5 system-ui,sans-serif;margin:12px;color:#17181c;background:#fff}button,input,select,textarea{font:inherit}button{padding:5px 10px;margin:2px}input,select{padding:4px 6px;margin:2px}li,p,td,th,label{margin:2px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}.card{display:inline-block;border:1px solid #ccc;border-radius:8px;padding:8px 12px;margin:4px;vertical-align:top}.badge{background:#4338ca;color:#fff;border-radius:4px;padding:0 6px;font-size:12px}a{color:#2457c5}iframe{background:#fff}";
const HIT = "3px solid #4338ca";
const GOAL = "3px dashed #1d7f55";

const KITCHEN = `<div id="sample" class="shop">
  <header><nav aria-label="Main"><a href="/home">Home</a> <a href="/docs" class="active">Docs</a> <a href="https://example.test/blog">Blog</a></nav></header>
  <main>
    <h1 class="title">Fresh Fruit</h1>
    <ul class="items">
      <li class="item" data-price="3">Apple <span class="tag">new</span></li>
      <li class="item sale" data-price="2">Banana</li>
      <li class="item" data-price="5">Cherry <span class="tag">hot</span></li>
    </ul>
    <form id="login-form" class="login" data-testid="login">
      <label for="username">Username</label><input id="username" name="user_name" class="input primary-input" placeholder="Enter username">
      <label>Password <input id="pwd" name="pass" type="password"></label>
      <label><input type="checkbox" name="remember" checked> Remember me</label>
      <select name="country" aria-label="Country"><option>France</option><option value="ca">Canada</option></select>
      <button id="signin" name="signin" class="btn primary submit-btn" type="submit" data-testid="signin" aria-label="Sign in">Sign in</button>
      <button type="reset" class="btn">Clear</button>
      <button type="button" disabled>Disabled</button>
      <button type="button" style="display:none">Hidden</button>
    </form>
    <table id="books"><thead><tr><th>Title</th><th>Author</th><th>Price</th></tr></thead><tbody>
      <tr><td>Clean Code</td><td>Robert Martin</td><td>32.00</td></tr>
      <tr><td>Testing JavaScript</td><td>Kent Dodds</td><td>29.00</td></tr></tbody></table>
    <ul id="menu-list" class="nested"><li>One</li><li>Two</li><li>Three<ul><li>Three-A</li><li class="target">Three-B</li></ul></li><li>Four</li></ul>
    <div role="radiogroup"><label><input type="radio" name="grp" value="Alpha" disabled> Alpha</label><label><input type="radio" name="grp" value="Beta"> Beta</label><label><input type="radio" name="grp" value="Gamma" disabled> Gamma</label></div>
    <svg width="60" height="30" viewBox="0 0 60 30" role="img" aria-label="Chart"><circle cx="15" cy="15" r="10"/><rect x="32" y="5" width="20" height="20"/></svg>
    <ty-card id="host"></ty-card>
    <iframe name="inner-frame" title="Inner frame" style="width:100%;height:60px" srcdoc="${"<button id=&quot;frame-btn&quot;>Inside the frame</button>"}"></iframe>
  </main>
  <footer><p>© TestYard</p></footer>
</div>`;
const kitchenSetup = (doc) => { const r = doc.getElementById("host").attachShadow({ mode: "open" }); r.innerHTML = `<h4>Shadow card</h4><input placeholder="inside shadow"> <button id="shadow-btn">Go</button>`; };
const PRESETS = {
  "Login form": `<form><h2>Sign in</h2><label for="u">Email</label><input id="u" type="email" placeholder="you@example.com"><label for="p">Password</label><input id="p" type="password"><label><input type="checkbox"> Remember me</label><button type="submit">Sign in</button> <a href="#">Forgot password?</a></form>`,
  "Product cards": `<div class="grid"><div class="card" data-testid="p1"><h4>Mug</h4><span class="price">$12</span><button>Add to cart</button></div><div class="card" data-testid="p2"><h4>Keyboard</h4><span class="badge">SALE</span><span class="price">$89</span><button>Add to cart</button></div></div>`,
  "Data table": `<table><thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead><tbody><tr><td>Asha</td><td>QA</td><td>Active</td></tr><tr><td>Liam</td><td>SDET</td><td>Pending</td></tr></tbody></table>`,
  "Nested menu": `<ul class="nav"><li>Products<ul><li><a href="#">Laptops</a></li><li><a href="#">Phones</a></li></ul></li><li>Support</li></ul>`,
};

/** Sanitise pasted HTML. The preview iframe is also sandboxed (no scripts) and the page CSP blocks inline scripts. */
function clean(markup) {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  doc.querySelectorAll("script,frame,frameset,object,embed,link,meta,base,template,noscript,math").forEach((el) => el.remove());
  doc.querySelectorAll("iframe").forEach((f) => { if (!f.hasAttribute("srcdoc")) f.remove(); else f.removeAttribute("src"); });
  for (const el of doc.body.querySelectorAll("*")) {
    for (const a of [...el.attributes]) {
      const name = a.name.toLowerCase(), val = a.value.replace(/[\u0000- ]+/g, "").toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src" || name === "action" || name === "formaction" || name === "xlink:href") && /^(javascript|vbscript):/.test(val))) el.removeAttribute(a.name);
      if (name === "src" && !/^data:image\//.test(val)) el.removeAttribute(a.name);
    }
  }
  return doc.body.innerHTML;
}
const docOf = (html) => `<!doctype html><html><head><meta charset="utf-8"><style>${FRAME_CSS}</style></head><body>${html}</body></html>`;
const solved = new Set(store.get("lab.solved", []));
const keepSolved = () => store.set("lab.solved", [...solved]);

function sameSet(a, b) { return a.length === b.length && a.every((x) => b.includes(x)); }
function targetNodes(s, doc) {
  const list = [].concat(s.targetPw || s.target);
  const out = [];
  for (const t of list) { const r = evaluate(t, doc); if (r.error) throw new Error(`Scenario "${s.id}" has a bad target: ${r.error}`); for (const n of r.nodes) if (!out.includes(n)) out.push(n); }
  return out;
}

page({
  id: "locators", group: "dom", title: "Locator Lab",
  blurb: "One workbench for CSS, XPath, axes and Playwright locators: 95+ tricky scenarios with live match checking.",
  tasks: [
    "Solve one scenario in every category: CSS, XPath, XPath axes and Playwright built-in locators.",
    "Write the same locator three ways (CSS, XPath, getByRole) and compare how robust each is.",
    "Make a locator that matches exactly one element, then break it on purpose and read the strict-mode warning.",
    "Paste your own HTML into the Sandbox tab and pick locators by clicking elements in the preview.",
    "Try the shadow DOM and iframe scenarios and explain why XPath cannot reach inside shadow roots.",
  ],
  render(root) {
    const qs = new URLSearchParams(location.search);
    let tab = ["scenarios", "sandbox", "kitchen"].includes(qs.get("tab")) ? qs.get("tab") : "scenarios";
    let current = scenarios.find((s) => s.id === qs.get("s")) || scenarios.find((s) => s.id === store.get("lab.last")) || scenarios[0];
    let frame = null, timer = 0, goalOn = false, lastPicked = null;
    const marked = new Map();

    // ---------------------------------------------------------------- workbench
    const input = h("textarea", { rows: "2", class: "mono lab-input", spellcheck: "false", autocomplete: "off", "aria-label": "Locator", "data-testid": "lab-locator",
      placeholder: "CSS  ·  XPath  ·  text=…  ·  page.getByRole('button', { name: 'Save' })" });
    const kind = h("div", { class: "lab-kind", "data-testid": "lab-kind", "aria-live": "polite" });
    const countEl = h("div", { class: "lab-count", "data-testid": "lab-result", role: "status" });
    const status = h("div", { "data-testid": "lab-status", role: "status" });
    const notes = h("ul", { class: "lab-notes", "data-testid": "lab-notes" });
    const matches = h("ol", { class: "lab-matches", "data-testid": "lab-matches" });
    const picks = h("div", { "data-testid": "lab-suggestions", class: "lab-picks" }, h("p", { class: "muted", text: "Click any element in the preview to get ranked locator suggestions." }));
    const frameHost = h("div", { class: "lab-frame-host" });

    const clearMarks = () => { for (const [el, prev] of marked) { try { el.style.outline = prev.o; el.style.outlineOffset = prev.f; } catch { /* element gone */ } } marked.clear(); };
    const mark = (el, style) => { if (!marked.has(el)) marked.set(el, { o: el.style.outline, f: el.style.outlineOffset }); el.style.outline = style; el.style.outlineOffset = "2px"; };

    function run() {
      const doc = frame?.contentDocument;
      if (!doc || !doc.body) return;
      clearMarks();
      const ev = evaluate(input.value, doc);
      let want = [], targetError = "";
      if (tab === "scenarios") { try { want = targetNodes(current, doc); } catch (e) { targetError = e.message; } }
      if (goalOn) want.forEach((n) => mark(n, GOAL));
      ev.nodes.forEach((n) => mark(n, HIT));
      kind.replaceChildren(h("span", { class: "tag acc", "data-testid": "lab-kind-label", text: input.value.trim() ? ev.label : "Waiting for a locator" }), ...ev.chips.map((c) => h("span", { class: "tag", text: c })));
      if (ev.error) {
        countEl.replaceChildren(h("div", { class: "alert bad", "data-testid": "lab-error", text: ev.error }));
      } else if (input.value.trim()) {
        const n = ev.nodes.length;
        const cls = n === 1 ? "ok" : n === 0 ? "warn" : "info";
        countEl.replaceChildren(h("div", { class: "alert " + cls }, h("b", { "data-testid": "lab-count", text: String(n) }), n === 1 ? " match" : " matches",
          n > 1 ? h("span", { class: "muted", text: "  ·  a click()/fill() would throw a strict-mode violation" }) : n === 0 ? h("span", { class: "muted", text: "  ·  nothing matches (yet)" }) : null));
      } else countEl.replaceChildren();
      notes.replaceChildren(...ev.notes.map((t) => h("li", { text: t })), ...(ev.assertion ? [h("li", { "data-testid": "lab-assertion", class: ev.assertion.ok ? "ok" : "bad", text: ev.assertion.message })] : []));
      matches.replaceChildren(...ev.nodes.slice(0, 12).map((n) => h("li", {}, h("code", { text: describeNode(n) }))), ev.nodes.length > 12 ? h("li", { class: "muted", text: `…and ${ev.nodes.length - 12} more` }) : null);
      if (tab === "scenarios" && want.length && input.value.trim() && !ev.error) {
        const ok = sameSet(ev.nodes, want);
        if (ok && !solved.has(current.id)) { solved.add(current.id); keepSolved(); toast("Solved: " + current.title, "ok", 2200); renderList(); }
        status.replaceChildren(ok
          ? h("div", { class: "alert ok", "data-testid": "lab-solved", text: `✔ Correct. Your locator matches exactly the ${want.length === 1 ? "target element" : want.length + " target elements"}.` })
          : h("div", { class: "alert warn", "data-testid": "lab-unsolved", text: `Not yet: you match ${ev.nodes.length}, the goal needs ${want.length}${ev.nodes.some((n) => !want.includes(n)) ? " (some matches are wrong)" : ""}.` }));
      } else status.replaceChildren(...(targetError ? [h("div", { class: "alert bad", text: targetError })] : []));
    }
    const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 80); };
    input.addEventListener("input", () => { schedule(); status.replaceChildren(); });

    function onPick(e) {
      e.preventDefault(); e.stopPropagation();
      const el = e.target;
      if (!el || el.nodeType !== 1 || el.tagName === "HTML" || el.tagName === "BODY") return;
      lastPicked = el;
      const doc = frame.contentDocument;
      const list = suggest(el, doc);
      picks.replaceChildren(h("p", { class: "label", text: "Picked: " }, h("code", { text: describeNode(el, 90) })),
        h("ul", { class: "lab-sug" }, list.map((r) => h("li", {},
          h("span", { class: "tag " + (r.unique ? "ok" : r.count ? "warn" : "bad"), text: r.unique ? "unique" : r.count + " matches" }),
          h("span", { class: "tag", text: r.type }), h("code", { text: r.expr }),
          h("button", { class: "btn sm", type: "button", "data-testid": "lab-use", onClick: () => { input.value = r.expr; run(); input.focus(); } }, "Use"),
          h("button", { class: "btn sm", type: "button", onClick: () => copy(r.expr) }, "Copy"),
          r.note ? h("small", { class: "muted", text: " " + r.note }) : null))));
    }
    function mount(html, setup) {
      clearMarks();
      frame = h("iframe", { class: "lab-frame", title: "Practice DOM", "data-testid": "lab-frame", sandbox: "allow-same-origin" });
      frame.addEventListener("load", () => {
        try { setup?.(frame.contentDocument); } catch { /* setup is best effort */ }
        frame.contentDocument.addEventListener("click", onPick, true);
        run();
      });
      frame.srcdoc = docOf(html);
      frameHost.replaceChildren(frame);
    }
    const goalBtn = h("button", { class: "btn sm", type: "button", "data-testid": "lab-show-target", "aria-pressed": "false", onClick: () => { goalOn = !goalOn; goalBtn.setAttribute("aria-pressed", String(goalOn)); goalBtn.textContent = goalOn ? "Hide target" : "Show target"; run(); } }, "Show target");

    const bench = h("div", { class: "lab-bench" },
      h("label", { class: "label", for: "lab-in" , text: "Your locator" }), input,
      h("div", { class: "lab-try" }, h("span", { class: "muted", text: "Try: " }), [
        ["CSS", "ul > li:first-child"], ["XPath", "//button[normalize-space()='Sign in']"], ["Axes", "//label[text()='Username']/following-sibling::input"],
        ["getByRole", "page.getByRole('button', { name: 'Sign in' })"], ["text=", "text=Sign in"], ["chain", "page.getByRole('listitem').filter({ hasText: 'Banana' })"],
      ].map(([l, v]) => h("button", { class: "btn sm ghost", type: "button", title: v, onClick: () => { input.value = v; run(); } }, l))),
      kind, countEl, status, h("ul", { class: "lab-notes-wrap" }, notes), matches);
    input.id = "lab-in";

    // ---------------------------------------------------------------- scenarios tab
    const list = h("div", { class: "lab-list", "data-testid": "lab-list" });
    const search = h("input", { type: "search", placeholder: "Filter scenarios…", "aria-label": "Filter scenarios", "data-testid": "lab-search" });
    const catSel = h("select", { "aria-label": "Category", "data-testid": "lab-cat" }, h("option", { value: "", text: "All categories" }), CATEGORIES.map(([id, t]) => h("option", { value: id, text: t })));
    const lvlSel = h("select", { "aria-label": "Level", "data-testid": "lab-level" }, h("option", { value: "", text: "Any level" }), [1, 2, 3].map((n) => h("option", { value: n, text: ["", "Beginner", "Intermediate", "Advanced"][n] })));
    const todo = h("input", { type: "checkbox", "data-testid": "lab-unsolved-only", id: "lab-todo" });
    const progress = h("p", { class: "mono lab-progress", "data-testid": "lab-progress" });
    const detail = h("div", { class: "lab-detail", "data-testid": "lab-detail" });
    function renderList() {
      const q = search.value.trim().toLowerCase();
      const items = scenarios.filter((s) => (!catSel.value || s.cat === catSel.value) && (!lvlSel.value || s.lvl === Number(lvlSel.value)) && (!todo.checked || !solved.has(s.id)) && (!q || (s.title + " " + s.goal + " " + s.id).toLowerCase().includes(q)));
      progress.textContent = `${[...solved].filter((id) => scenarios.some((s) => s.id === id)).length} / ${scenarios.length} solved`;
      list.replaceChildren(...CATEGORIES.flatMap(([cid, ctitle]) => {
        const group = items.filter((s) => s.cat === cid);
        if (!group.length) return [];
        return [h("div", { class: "lab-cat", text: ctitle }), ...group.map((s) => h("button", { type: "button", class: "lab-item" + (s.id === current.id ? " on" : ""), "data-testid": "lab-scenario-" + s.id, "aria-current": s.id === current.id ? "true" : null, onClick: () => pick(s) },
          h("span", { class: "dot" + (solved.has(s.id) ? " done" : ""), "aria-hidden": "true" }), h("span", { class: "lab-it", text: s.title }), h("small", { class: "lab-lvl", text: "★".repeat(s.lvl) })))];
      }), items.length ? [] : [h("p", { class: "muted", text: "No scenarios match the filters." })]);
    }
    function showDetail() {
      const s = current;
      const hint = h("p", { class: "muted", "data-testid": "lab-hint", hidden: true, text: s.hint });
      const sol = h("div", { "data-testid": "lab-solutions", hidden: true });
      const block = (title, arr) => arr.length ? h("div", {}, h("div", { class: "label", text: title }), h("ul", { class: "lab-sol" }, arr.map((x) => h("li", {}, h("code", { text: x }),
        h("button", { class: "btn sm", type: "button", "data-testid": "lab-try", onClick: () => { input.value = x; run(); } }, "Try"), h("button", { class: "btn sm", type: "button", onClick: () => copy(x) }, "Copy"))))) : null;
      sol.append(block("CSS", s.css), block("XPath", s.xpath), block("Playwright", s.pw), s.xpath.length ? null : h("p", { class: "muted", text: "No XPath solution: XPath cannot cross this boundary." }), s.avoid ? h("p", { class: "alert warn", text: "Avoid: " + s.avoid }) : null);
      const cat = CATEGORIES.find(([id]) => id === s.cat)?.[1];
      detail.replaceChildren(
        h("div", { class: "row", style: { justifyContent: "space-between" } }, h("div", {}, h("span", { class: "eyebrow", text: cat }), h("h2", { text: s.title, "data-testid": "lab-title", style: { margin: 0 } })), h("span", { class: "tag " + ["", "ok", "warn", "bad"][s.lvl], text: ["", "Beginner", "Intermediate", "Advanced"][s.lvl] })),
        h("p", { class: "lab-goal", "data-testid": "lab-goal" }, h("b", { text: "Goal: " }), s.goal),
        h("div", { class: "row" },
          h("button", { class: "btn sm", type: "button", "data-testid": "lab-hint-btn", onClick: () => { hint.hidden = !hint.hidden; } }, "Hint"), goalBtn,
          h("button", { class: "btn sm", type: "button", "data-testid": "lab-reveal", onClick: () => { sol.hidden = !sol.hidden; } }, "Reveal solutions"),
          h("button", { class: "btn sm", type: "button", "data-testid": "lab-next", onClick: () => { const i = scenarios.indexOf(current); pick(scenarios[(i + 1) % scenarios.length]); } }, "Next →")),
        hint, sol);
    }
    function pick(s) {
      current = s; store.set("lab.last", s.id); goalOn = false; goalBtn.setAttribute("aria-pressed", "false"); goalBtn.textContent = "Show target";
      input.value = ""; status.replaceChildren();
      history.replaceState({}, "", `/practice/locators?tab=scenarios&s=${s.id}`);
      showDetail(); renderList(); mount(s.html, s.setup);
    }
    [search, catSel, lvlSel, todo].forEach((x) => x.addEventListener("input", renderList));
    const scenariosMain = h("div", { class: "lab-main" });
    const scenariosPane = h("div", { class: "lab-layout" },
      h("aside", { class: "lab-side" }, search, h("div", { class: "row", style: { margin: "8px 0" } }, catSel, lvlSel), h("label", { class: "check", for: "lab-todo" }, todo, "Unsolved only"), progress, list), scenariosMain);

    // ---------------------------------------------------------------- sandbox + kitchen tabs
    const htmlBox = h("textarea", { rows: "10", class: "mono", spellcheck: "false", "aria-label": "Your HTML", "data-testid": "lab-html" });
    htmlBox.value = PRESETS["Login form"];
    const presetSel = h("select", { "aria-label": "Example HTML", "data-testid": "lab-preset" }, Object.keys(PRESETS).map((k) => h("option", { value: k, text: k })));
    presetSel.addEventListener("change", () => { htmlBox.value = PRESETS[presetSel.value]; mount(clean(htmlBox.value)); });
    htmlBox.addEventListener("input", () => { clearTimeout(htmlBox._t); htmlBox._t = setTimeout(() => mount(clean(htmlBox.value)), 250); });
    const sandboxPane = h("div", { class: "lab-sandbox" });
    const sandboxIntro = [h("p", { class: "muted", text: "Paste any HTML. Scripts and event handlers are stripped; the preview runs in a sandboxed frame. Then try any locator on it." }),
      h("div", { class: "row", style: { marginBottom: "8px" } }, h("label", { class: "label", for: "lab-preset", text: "Start from" }), presetSel), htmlBox];
    const kitchenPane = h("div", { class: "lab-sandbox" });

    // ---------------------------------------------------------------- tabs
    const tabs = [["scenarios", "Scenarios"], ["sandbox", "Your HTML"], ["kitchen", "Kitchen sink"]];
    const panes = h("div", { class: "lab-pane" });
    const tabBtns = tabs.map(([id, label]) => h("button", { role: "tab", type: "button", "data-testid": "lab-tab-" + id, "aria-selected": String(id === tab), onClick: () => show(id) }, label));
    function show(id) {
      tab = id; clearMarks();
      tabBtns.forEach((b, i) => b.setAttribute("aria-selected", String(tabs[i][0] === id)));
      history.replaceState({}, "", id === "scenarios" ? `/practice/locators?tab=scenarios&s=${current.id}` : `/practice/locators?tab=${id}`);
      status.replaceChildren(); input.value = "";
      if (id === "scenarios") { scenariosMain.replaceChildren(detail, frameHost, bench, picks); panes.replaceChildren(scenariosPane); showDetail(); renderList(); mount(current.html, current.setup); }
      else if (id === "sandbox") { sandboxPane.replaceChildren(...sandboxIntro, frameHost, bench, picks); panes.replaceChildren(sandboxPane); mount(clean(htmlBox.value)); }
      else {
        kitchenPane.replaceChildren(h("p", { class: "muted", text: "A realistic page with forms, tables, nested lists, SVG, hidden elements, a shadow root and an iframe. Use it for free practice." }), frameHost, bench, picks);
        panes.replaceChildren(kitchenPane); mount(KITCHEN, kitchenSetup);
      }
    }
    root.append(h("section", { class: "stage" }, h("div", { class: "tabs" }, h("div", { role: "tablist" }, tabBtns), panes)));
    show(tab);
    return () => { clearTimeout(timer); clearTimeout(htmlBox._t); clearMarks(); };
  },
});
