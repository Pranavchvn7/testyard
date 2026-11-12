import { page } from "../registry.js";
import { h, $, $$, toast, stage, field, sleep, rand, pick } from "../ui.js";

// ---------------------------------------------------------------- hover
page({
  id: "hover", group: "elements", title: "Hover, menus & tooltips",
  blurb: "Content revealed only on hover or focus: nested menus, user cards and tooltips.",
  tasks: ["Hover “Products” and click “Laptops” in the submenu.", "Hover each avatar and assert the hidden caption and profile link.", "Assert the tooltip text appears on hover and on keyboard focus."],
  render(root) {
    const out = h("p", { class: "mono", "data-testid": "hover-out", text: "Clicked: —" });
    const sub = (label, items) => {
      const panel = h("div", { class: "menu", style: { display: "none", top: "100%", left: 0 } }, items.map((i) => h("button", { type: "button", "data-testid": "menu-" + i.toLowerCase(), onClick: () => (out.textContent = "Clicked: " + i) }, i)));
      const wrap = h("div", { style: { position: "relative", display: "inline-block" }, onMouseenter: () => (panel.style.display = "block"), onMouseleave: () => (panel.style.display = "none"), onFocusin: () => (panel.style.display = "block"), onFocusout: (e) => { if (!wrap.contains(e.relatedTarget)) panel.style.display = "none"; } },
        h("button", { class: "btn", type: "button", "data-testid": "hover-" + label.toLowerCase() }, label + " ▾"), panel);
      return wrap;
    };
    const users = ["Asha", "Liam", "Mei"].map((n, i) => {
      const cap = h("div", { class: "hint", style: { visibility: "hidden" }, "data-testid": "caption-" + (i + 1) }, [h("b", { text: "name: " + n }), " ", h("a", { href: "/practice/hover", text: "View profile" })]);
      return h("figure", { style: { margin: 0, textAlign: "center", width: "120px" }, onMouseenter: () => (cap.style.visibility = "visible"), onMouseleave: () => (cap.style.visibility = "hidden"), "data-testid": "avatar-" + (i + 1) },
        h("div", { style: { fontSize: "3rem", background: "var(--surface-2)", borderRadius: "50%", width: "84px", height: "84px", display: "grid", placeItems: "center", margin: "0 auto 6px" } }, ["🧑‍💻", "👩‍🔬", "🧑‍🚀"][i]), cap);
    });
    const tip = (label, text, id) => h("span", { class: "tip" }, h("button", { class: "btn", type: "button", "aria-describedby": id, "data-testid": id }, label), h("span", { class: "bubble", role: "tooltip", id: id + "-tip", "data-testid": id + "-tip", text }));
    root.append(
      stage(h("h2", { text: "Hover menu" }), h("div", { class: "row", style: { minHeight: "150px", alignItems: "flex-start" } }, sub("Products", ["Mobiles", "Laptops", "Tablets"]), sub("Company", ["About", "Careers"])), out),
      stage(h("h2", { text: "Hover to reveal" }), h("div", { class: "row", style: { gap: "28px" } }, users)),
      stage(h("h2", { text: "Tooltips" }), h("div", { class: "row", style: { paddingTop: "34px" } }, tip("Save", "Saves your work", "tip-save"), tip("Delete", "This cannot be undone", "tip-delete"), h("button", { class: "btn", type: "button", title: "Native title tooltip", "data-testid": "native-title" }, "Native title"))));
  },
});

// ---------------------------------------------------------------- mouse & keyboard
page({
  id: "mouse", group: "elements", title: "Mouse & keyboard actions",
  blurb: "Double click, right click with a custom context menu, click-and-hold and keyboard event capture.",
  tasks: ["Double-click the button and assert Field 2 copies Field 1.", "Right-click the box, choose “Rename” and assert the result.", "Hold the button for 2 s with mouse.down() / wait / mouse.up().", "Press Shift+A and assert key, code and modifiers.", "Press Ctrl+K inside the box to trigger the shortcut."],
  render(root) {
    const f1 = h("input", { type: "text", id: "field1", value: "Hello TestYard", "data-testid": "field1" }), f2 = h("input", { type: "text", id: "field2", "data-testid": "field2" });
    const dbl = h("button", { class: "btn primary", type: "button", "data-testid": "dblclick" }, "Double-click me");
    dbl.addEventListener("dblclick", () => { f2.value = f1.value; dbl.style.background = "var(--ok)"; });

    const ctxBox = h("div", { class: "drop-target", tabindex: "0", "data-testid": "context-area" }, "Right-click anywhere in this box");
    const ctxOut = h("p", { class: "mono", "data-testid": "context-out", text: "Action: —" });
    let menu = null;
    const closeMenu = () => { menu?.remove(); menu = null; };
    ctxBox.addEventListener("contextmenu", (e) => {
      e.preventDefault(); closeMenu();
      const r = ctxBox.getBoundingClientRect();
      menu = h("div", { class: "menu", role: "menu", "data-testid": "context-menu", style: { left: e.clientX - r.left + "px", top: e.clientY - r.top + "px" } }, ["Rename", "Duplicate", "Delete"].map((a) => h("button", { type: "button", role: "menuitem", "data-testid": "ctx-" + a.toLowerCase(), onClick: () => { ctxOut.textContent = "Action: " + a; closeMenu(); } }, a)));
      ctxBox.append(menu);
    });
    const onDoc = (e) => { if (menu && !menu.contains(e.target)) closeMenu(); };
    document.addEventListener("click", onDoc);
    ctxBox.style.position = "relative";

    const fill = h("i"); const holdOut = h("p", { class: "mono", "data-testid": "hold-out", text: "Hold status: idle" });
    const hold = h("button", { class: "btn hold-btn", type: "button", "data-testid": "hold" }, fill, h("span", { text: "Press and hold 2 s" }));
    let t0 = 0, raf = 0;
    const tick = () => { const p = Math.min(1, (performance.now() - t0) / 2000); fill.style.width = p * 100 + "%"; if (p < 1) raf = requestAnimationFrame(tick); else holdOut.textContent = "Hold status: completed ✔"; };
    hold.addEventListener("mousedown", () => { t0 = performance.now(); holdOut.textContent = "Hold status: holding…"; raf = requestAnimationFrame(tick); });
    const stop = () => { cancelAnimationFrame(raf); if (!/completed/.test(holdOut.textContent) && t0) holdOut.textContent = "Hold status: released too early"; fill.style.width = "0"; t0 = 0; };
    hold.addEventListener("mouseup", stop); hold.addEventListener("mouseleave", stop);

    const keyBox = h("input", { type: "text", placeholder: "Focus here and press any key", "data-testid": "key-input" });
    const keyOut = h("pre", { "data-testid": "key-out" }, "No key pressed yet");
    keyBox.addEventListener("keydown", (e) => {
      keyOut.textContent = JSON.stringify({ key: e.key, code: e.code, shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey, repeat: e.repeat }, null, 2);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); toast("Shortcut Ctrl/Cmd+K triggered", "ok"); }
    });
    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Double click" }), h("div", { class: "grid g2" }, field("Field 1", f1), field("Field 2", f2)), dbl),
      stage(h("h2", { text: "Context menu" }), ctxBox, ctxOut),
      stage(h("h2", { text: "Click & hold" }), hold, holdOut),
      stage(h("h2", { text: "Keyboard" }), keyBox, h("div", { style: { marginTop: "10px" } }, keyOut), h("p", { class: "hint", html: "Try <kbd>Ctrl</kbd>+<kbd>K</kbd> inside the field." }))));
    return () => document.removeEventListener("click", onDoc);
  },
});

// ---------------------------------------------------------------- drag & drop
page({
  id: "dragdrop", group: "elements", title: "Drag & drop",
  blurb: "HTML5 drag and drop: a single draggable, a sortable list and a matching game.",
  tasks: ["Drag the box into the drop zone and assert it turns green.", "Reorder the list so “Gamma” is first and read the order.", "Match all three shapes to their holes.", "Try dragging with both locator.dragTo() and manual mouse moves."],
  render(root) {
    // 1 basic
    const item = h("div", { class: "drag-item", draggable: "true", id: "drag-me", "data-testid": "drag-me" }, "Drag me");
    const zone = h("div", { class: "drop-target", id: "drop-zone", "data-testid": "drop-zone" }, "Drop here");
    item.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", "drag-me"); item.classList.add("dragging"); });
    item.addEventListener("dragend", () => item.classList.remove("dragging"));
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); zone.classList.add("filled"); zone.replaceChildren(item, h("span", { text: " Dropped!" })); });

    // 2 sortable
    const list = h("ul", { style: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "8px" }, "data-testid": "sortable" });
    ["Alpha", "Beta", "Gamma", "Delta"].forEach((n) => list.append(h("li", { class: "drag-item", draggable: "true", "data-testid": "sort-" + n.toLowerCase() }, n)));
    const order = h("p", { class: "mono", "data-testid": "sort-order", text: "Order: Alpha, Beta, Gamma, Delta" });
    let dragging = null;
    list.addEventListener("dragstart", (e) => { dragging = e.target.closest("li"); dragging?.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragging?.textContent || ""); });
    list.addEventListener("dragend", () => { dragging?.classList.remove("dragging"); dragging = null; order.textContent = "Order: " + [...list.children].map((x) => x.textContent).join(", "); });
    list.addEventListener("dragover", (e) => {
      e.preventDefault(); const over = e.target.closest("li");
      if (!over || over === dragging || !dragging) return;
      const r = over.getBoundingClientRect();
      list.insertBefore(dragging, e.clientY < r.top + r.height / 2 ? over : over.nextSibling);
    });

    // 3 matching
    const shapes = [["circle", "●"], ["square", "■"], ["triangle", "▲"]];
    const matched = h("p", { class: "mono", "data-testid": "match-out", text: "Matched: 0 / 3" });
    let n = 0;
    const holes = shapes.map(([k, g]) => {
      const hole = h("div", { class: "drop-target", style: { width: "92px", minHeight: "92px", fontSize: "2rem", opacity: ".7" }, "data-testid": "hole-" + k }, g);
      hole.addEventListener("dragover", (e) => { e.preventDefault(); hole.classList.add("over"); });
      hole.addEventListener("dragleave", () => hole.classList.remove("over"));
      hole.addEventListener("drop", (e) => {
        e.preventDefault(); hole.classList.remove("over");
        if (e.dataTransfer.getData("text/shape") === k) { hole.classList.add("filled"); hole.textContent = "✔"; $(`[data-testid=shape-${k}]`, root)?.remove(); matched.textContent = `Matched: ${++n} / 3`; if (n === 3) toast("All matched!", "ok"); }
        else toast("Wrong hole", "bad", 1500);
      });
      return hole;
    });
    const pieces = [...shapes].reverse().map(([k, g]) => {
      const el = h("div", { class: "drag-item", draggable: "true", style: { fontSize: "1.6rem" }, "data-testid": "shape-" + k, title: k }, g);
      el.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/shape", k));
      return el;
    });

    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Basic" }), h("div", { class: "row" }, item, zone)),
      stage(h("h2", { text: "Sortable list" }), list, order),
      stage(h("h2", { text: "Match the shapes" }), h("div", { class: "row", style: { marginBottom: "12px" } }, pieces), h("div", { class: "row" }, holes), matched)));
  },
});

// ---------------------------------------------------------------- frames & windows
page({
  id: "frames", group: "elements", title: "iFrames & windows",
  blurb: "Single and nested iframes plus tabs and popup windows that you must switch between.",
  tasks: ["Switch into the iframe, type into the editor and read it back.", "Reach the nested iframe two levels deep.", "Open the new tab, assert its heading, close it and return.", "Handle the popup window event."],
  render(root) {
    const style = "<style>body{font:15px system-ui;padding:12px;margin:0}input,button{font:inherit;padding:6px}</style>";
    const frameCss = { width: "100%", border: "1px solid var(--line)", borderRadius: "8px" };
    const f1 = h("iframe", { title: "Editor frame", "data-testid": "frame-simple", name: "simple-frame", style: { ...frameCss, height: "150px" },
      srcdoc: `${style}<h3 id="frame-title">Inside the iframe</h3><input id="inner-input" placeholder="type here"> <button id="inner-btn">Say</button><p id="inner-out">Clicked: —</p>` });
    const innermost = `${style}<h3 id="deep-title">Level 2 frame</h3><button id="deep-btn">Click deep</button>`;
    const f2 = h("iframe", { title: "Parent frame", "data-testid": "frame-nested", name: "outer-frame", style: { ...frameCss, height: "230px" },
      srcdoc: `${style}<h3 id="outer-title">Level 1 frame</h3><iframe title="Inner frame" name="inner-frame" style="width:100%;height:120px" srcdoc="${innermost.replace(/"/g, "&quot;")}"></iframe>` });
    // srcdoc frames are same-origin, so the parent can attach the listeners (inline onclick would be blocked by our CSP).
    f1.addEventListener("load", () => { const d = f1.contentDocument; d.getElementById("inner-btn").addEventListener("click", () => { d.getElementById("inner-out").textContent = "Clicked: " + d.getElementById("inner-input").value; }); });
    f2.addEventListener("load", () => { const d = f2.contentDocument.querySelector("iframe")?.contentDocument; d?.getElementById("deep-btn").addEventListener("click", (e) => { e.target.textContent = "Deep click ✔"; }); });
    root.append(h("div", { class: "grid g2" }, stage(h("h2", { text: "Simple iframe" }), f1), stage(h("h2", { text: "Nested iframes" }), f2)),
      stage(h("h2", { text: "Windows" }), h("div", { class: "row" },
        h("a", { class: "btn", href: "/practice/window-child", target: "_blank", rel: "noopener", "data-testid": "open-tab" }, "Open new tab"),
        h("button", { class: "btn", type: "button", "data-testid": "open-popup", onClick: () => window.open("/practice/window-child", "_blank", "popup,width=500,height=340") }, "Open popup"))));
  },
});
page({
  id: "window-child", group: "elements", hidden: true, title: "I am the new window",
  blurb: "You switched here successfully. Close this window and go back to the parent.",
  render(root) { root.append(stage(h("p", { "data-testid": "child-text", text: "This is the child window content." }), h("button", { class: "btn", type: "button", "data-testid": "close-window", onClick: () => window.close() }, "Close window"))); },
});

// ---------------------------------------------------------------- shadow DOM
if (!customElements.get("ty-card")) {
  customElements.define("ty-card", class extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const r = this.attachShadow({ mode: "open" });
      r.innerHTML = `<style>.c{border:1px solid #bbb;border-radius:10px;padding:14px;font:15px system-ui;background:#fff;color:#111}input{padding:7px;border:1px solid #bbb;border-radius:6px;width:60%}button{padding:7px 12px;border-radius:6px;border:0;background:#e8481c;color:#fff;cursor:pointer}</style>
        <div class="c"><h4 id="shadow-title" style="margin:0 0 8px">${this.getAttribute("label") || "Shadow card"}</h4><input id="shadow-input" placeholder="inside shadow root"> <button id="shadow-btn">Go</button><p id="shadow-out" style="margin:8px 0 0">Result: —</p><slot></slot></div>`;
      r.getElementById("shadow-btn").addEventListener("click", () => (r.getElementById("shadow-out").textContent = "Result: " + r.getElementById("shadow-input").value));
    }
  });
  customElements.define("ty-closed", class extends HTMLElement {
    connectedCallback() { if (this.__r) return; this.__r = this.attachShadow({ mode: "closed" }); this.__r.innerHTML = `<button id="closed-btn" style="padding:8px 12px">Closed shadow button</button>`; }
  });
  customElements.define("ty-outer", class extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const r = this.attachShadow({ mode: "open" });
      r.innerHTML = `<div style="border:1px dashed #999;padding:10px;font:14px system-ui;color:#111;background:#fff"><b>Outer shadow</b><br><ty-card label="Nested shadow card"></ty-card></div>`;
    }
  });
}
page({
  id: "shadow", group: "elements", title: "Shadow DOM",
  blurb: "Open, nested and closed shadow roots — and what your locator engine can (and cannot) reach.",
  tasks: ["Fill the input inside the open shadow root (Playwright pierces it by default).", "In Selenium use getShadowRoot() and then find the elements.", "Reach the card nested inside another shadow root.", "Explain why the closed shadow root cannot be automated through the DOM."],
  render(root) {
    root.append(h("div", { class: "grid g2" },
      stage(h("h2", { text: "Open shadow root" }), h("ty-card", { "data-testid": "shadow-host", label: "Open shadow card" }, h("small", { text: "light-DOM slotted text" }))),
      stage(h("h2", { text: "Nested shadow roots" }), h("ty-outer", { "data-testid": "shadow-outer" })),
      stage(h("h2", { text: "Closed shadow root" }), h("ty-closed", { "data-testid": "shadow-closed" }), h("p", { class: "hint", text: "element.shadowRoot returns null for this host." }))));
  },
});

// ---------------------------------------------------------------- tabs & accordion
page({
  id: "tabs", group: "elements", title: "Tabs & accordion",
  blurb: "ARIA tabs with arrow-key navigation and an accordion where only one panel is open at a time.",
  tasks: ["Click each tab and assert the active panel text.", "Use ArrowRight/ArrowLeft on the focused tab.", "Open accordion panel 2 and assert panel 1 collapses.", "Assert aria-selected and aria-expanded values."],
  render(root) {
    const names = ["Overview", "Specs", "Reviews"];
    const tabs = names.map((n, i) => h("button", { role: "tab", id: "tab-" + i, "aria-controls": "panel-" + i, "aria-selected": String(i === 0), tabindex: i === 0 ? "0" : "-1", "data-testid": "tab-" + n.toLowerCase() }, n));
    const panels = names.map((n, i) => h("div", { role: "tabpanel", id: "panel-" + i, "aria-labelledby": "tab-" + i, hidden: i !== 0, "data-testid": "panel-" + n.toLowerCase() }, `${n} content: lorem ipsum dolor sit amet ${i + 1}.`));
    const select = (i, focus) => { tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(i === j)); t.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; }); if (focus) tabs[i].focus(); };
    tabs.forEach((t, i) => { t.addEventListener("click", () => select(i)); t.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") select((i + 1) % tabs.length, true); if (e.key === "ArrowLeft") select((i + tabs.length - 1) % tabs.length, true); }); });

    const items = ["What is TestYard?", "Is it free?", "Can I self-host it?"].map((q, i) => {
      const body = h("div", { hidden: i !== 0, id: "acc-body-" + i, "data-testid": "acc-body-" + (i + 1) }, ["A practice site for QA automation.", "Yes, MIT licensed and free forever.", "Yes: npm start, or use the Dockerfile."][i]);
      const btn = h("button", { type: "button", "aria-expanded": String(i === 0), "aria-controls": "acc-body-" + i, "data-testid": "acc-btn-" + (i + 1) }, q, h("span", { text: "＋" }));
      btn.addEventListener("click", () => { $$(".acc-item", root).forEach((it) => { const b = it.querySelector("button"), d = it.querySelector("div"); const open = it.contains(btn) && b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(open)); d.hidden = !open; }); });
      return h("div", { class: "acc-item" }, btn, body);
    });
    root.append(h("div", { class: "grid g2" }, stage(h("h2", { text: "Tabs" }), h("div", { class: "tabs" }, h("div", { role: "tablist", "aria-label": "Product" }, tabs), panels)), stage(h("h2", { text: "Accordion" }), items)));
  },
});

// ---------------------------------------------------------------- notifications & dynamic add/remove
page({
  id: "toasts", group: "elements", title: "Notifications & add/remove",
  blurb: "Auto-dismissing toasts, randomised notification text and elements added or removed at runtime.",
  tasks: ["Trigger a toast and assert it disappears after ~3.5 s.", "Click “Random notification” until you see all three outcomes.", "Add five elements, delete two, assert the count.", "Assert the closable alert is removed from the DOM, not just hidden."],
  render(root) {
    const msgs = [["Action successful", "ok"], ["Action unsuccessful, please try again", "bad"], ["Heads up: something needs attention", "warn"]];
    const holder = h("div", { "data-testid": "added", class: "row" });
    const count = h("p", { class: "mono", "data-testid": "added-count", text: "Elements: 0" });
    let n = 0;
    const upd = () => (count.textContent = "Elements: " + holder.children.length);
    const closable = h("div", { class: "alert info", "data-testid": "closable", style: { display: "flex", justifyContent: "space-between" } }, "This banner can be dismissed.", h("button", { class: "btn sm", type: "button", "aria-label": "Dismiss", "data-testid": "dismiss", onClick: () => closable.remove() }, "✕"));
    root.append(
      stage(h("h2", { text: "Toasts" }), h("div", { class: "row" },
        h("button", { class: "btn", type: "button", "data-testid": "toast-ok", onClick: () => toast("Saved successfully", "ok") }, "Show toast"),
        h("button", { class: "btn", type: "button", "data-testid": "toast-random", onClick: () => { const [m, t] = pick(msgs); toast(m, t); } }, "Random notification")), h("div", { style: { marginTop: "14px" } }, closable)),
      stage(h("h2", { text: "Add / remove elements" }), h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", "data-testid": "add-element", onClick: () => { holder.append(h("button", { class: "btn sm delete", type: "button", onClick: (e) => { e.currentTarget.remove(); upd(); } }, "Delete " + ++n)); upd(); } }, "Add element")), h("div", { style: { margin: "12px 0" } }, holder), count));
  },
});

// ---------------------------------------------------------------- scrolling
page({
  id: "scroll", group: "elements", title: "Scrolling & infinite scroll",
  blurb: "Elements below the fold, a sticky menu inside a scroll container and content that loads as you scroll.",
  tasks: ["Scroll “Footer target” into view and click it.", "Scroll the box until 50 items are loaded.", "Assert the sticky menu stays visible while scrolling.", "Use page.mouse.wheel() instead of scrollIntoView()."],
  render(root) {
    const inf = h("div", { class: "scroll-box", "data-testid": "infinite" });
    let n = 0, loading = false;
    const out = h("p", { class: "mono", "data-testid": "inf-count", text: "Loaded: 0" });
    const more = async () => { if (loading) return; loading = true; await sleep(250); for (let i = 0; i < 10; i++) inf.append(h("p", { "data-testid": "inf-item", style: { margin: "0 0 8px", padding: "8px", background: "var(--surface-2)", borderRadius: "6px" } }, `Item ${++n}`)); out.textContent = "Loaded: " + n; loading = false; };
    inf.addEventListener("scroll", () => { if (inf.scrollTop + inf.clientHeight >= inf.scrollHeight - 20) more(); });
    more().then(() => more());

    const long = h("div", { class: "scroll-box", style: { height: "300px" }, "data-testid": "long-box" },
      h("div", { class: "fixed-menu" }, h("span", { text: "Sticky menu" }), h("a", { href: "/practice/scroll", onClick: (e) => e.preventDefault(), text: "Home" }), h("a", { href: "/practice/scroll", onClick: (e) => e.preventDefault(), text: "Docs" })),
      Array.from({ length: 40 }, (_, i) => h("p", { text: `Filler paragraph ${i + 1}` })),
      h("button", { class: "btn primary", type: "button", id: "footer-target", "data-testid": "footer-target", onClick: () => toast("You reached the footer", "ok") }, "Footer target"));
    root.append(h("div", { class: "grid g2" }, stage(h("h2", { text: "Infinite scroll" }), inf, out), stage(h("h2", { text: "Sticky menu & scroll into view" }), long)));
  },
});

// ---------------------------------------------------------------- links & images
page({
  id: "links", group: "elements", title: "Links, redirects & images",
  blurb: "Links that return real HTTP status codes, redirect chains and broken versus healthy images.",
  tasks: ["Collect every link and assert its HTTP status with the request API.", "Follow the 3-hop redirect and assert the final URL.", "Detect broken images using naturalWidth === 0.", "Assert a link opens in a new tab with rel=noopener."],
  render(root) {
    const BASE = (window.TESTYARD_API_BASE || "").replace(/\/$/, "");
    const codes = [200, 201, 204, 400, 401, 403, 404, 418, 429, 500, 503];
    const out = h("p", { class: "mono", "data-testid": "img-out", text: "Click “Detect broken images”" });
    const svg = (c) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'><rect width='120' height='80' fill='${c}'/></svg>`);
    const imgs = h("div", { class: "row", "data-testid": "images" }, h("img", { src: svg("#2457c5"), alt: "good blue", width: 120, height: 80 }), h("img", { src: "/images/does-not-exist.png", alt: "broken one", width: 120, height: 80 }), h("img", { src: svg("#1d7f55"), alt: "good green", width: 120, height: 80 }), h("img", { src: "/images/missing-too.jpg", alt: "broken two", width: 120, height: 80 }));
    root.append(
      stage(h("h2", { text: "Status-code links" }), h("div", { class: "row" }, codes.map((c) => h("a", { class: "btn sm", href: `${BASE}/api/status/${c}`, target: "_blank", rel: "noopener", "data-testid": "status-" + c }, String(c))))),
      stage(h("h2", { text: "Redirects" }), h("div", { class: "row" }, h("a", { class: "btn", href: `${BASE}/api/redirect/1`, "data-testid": "redirect-1", target: "_blank", rel: "noopener" }, "1 hop"), h("a", { class: "btn", href: `${BASE}/api/redirect/3`, "data-testid": "redirect-3", target: "_blank", rel: "noopener" }, "3 hops"))),
      stage(h("h2", { text: "Images" }), imgs, h("div", { class: "row", style: { marginTop: "12px" } }, h("button", { class: "btn", type: "button", "data-testid": "detect-broken", onClick: async () => { await sleep(300); const bad = [...imgs.querySelectorAll("img")].filter((i) => !i.complete || i.naturalWidth === 0); out.textContent = `Broken images: ${bad.length} (${bad.map((b) => b.alt).join(", ")})`; } }, "Detect broken images")), out));
  },
});

// ---------------------------------------------------------------- svg
page({
  id: "svg", group: "elements", title: "SVG elements",
  blurb: "Interactive SVG shapes and text. Locators behave differently inside <svg>; learn the namespace gotchas.",
  tasks: ["Click each circle and assert the label.", "Locate shapes via CSS (svg circle) and XPath using local-name().", "Assert the rect fill attribute changes on click.", "Read the <text> content."],
  render(root) {
    const NS = "http://www.w3.org/2000/svg";
    const out = h("p", { class: "mono", "data-testid": "svg-out", text: "Clicked: none" });
    const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 420 160"); svg.setAttribute("width", "100%"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", "Clickable shapes"); svg.dataset.testid = "svg-canvas";
    const mk = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text) e.textContent = text; svg.append(e); return e; };
    [["red", "#c42b2b", 60], ["green", "#1d7f55", 140], ["blue", "#2457c5", 220]].forEach(([n, c, x]) => { const e = mk("circle", { id: "circle-" + n, cx: x, cy: 70, r: 32, fill: c, "data-testid": "circle-" + n, style: "cursor:pointer" }); e.addEventListener("click", () => (out.textContent = "Clicked: " + n + " circle")); });
    const rect = mk("rect", { id: "toggle-rect", x: 300, y: 38, width: 90, height: 64, rx: 10, fill: "#9a6408", "data-testid": "svg-rect", style: "cursor:pointer" });
    rect.addEventListener("click", () => rect.setAttribute("fill", rect.getAttribute("fill") === "#9a6408" ? "#e8481c" : "#9a6408"));
    mk("text", { id: "svg-label", x: 210, y: 140, "text-anchor": "middle", fill: "currentColor", "font-size": 16 }, "SVG label text");
    root.append(stage(svg, out));
  },
});
