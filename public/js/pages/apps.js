import { page } from "../registry.js";
import { h, $, $$, toast, modal, stage, field, api, auth, store, money, pretty, sleep } from "../ui.js";

const DEMO = { email: "practice@testyard.dev", password: "SecretPass1!" };

/** Generic form: fields [{name,label,type,value,autocomplete,placeholder}] */
function form(testid, fields, submitLabel, onSubmit) {
  const msg = h("div", { "data-testid": testid + "-msg", role: "alert" });
  const f = h("form", { "data-testid": testid, novalidate: true });
  f.append(...fields.map((x) => field(x.label, h("input", { name: x.name, type: x.type || "text", value: x.value || "", autocomplete: x.autocomplete || "off", placeholder: x.placeholder || "", "data-testid": testid + "-" + x.name }))),
    h("div", { class: "row" }, h("button", { class: "btn primary", type: "submit", "data-testid": testid + "-submit" }, submitLabel)), h("div", { style: { marginTop: "12px" } }, msg));
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("[type=submit]", f); btn.disabled = true;
    const values = Object.fromEntries(new FormData(f));
    const r = await onSubmit(values, f);
    btn.disabled = false;
    if (r) show(msg, r.ok, r.message, r.errors);
  });
  return f;
}
function show(el, ok, message, errors) {
  el.replaceChildren(h("div", { class: "alert " + (ok ? "ok" : "bad"), "data-testid": ok ? "msg-success" : "msg-error" }, message, errors?.length ? h("ul", { style: { margin: "6px 0 0", paddingLeft: "18px" } }, errors.map((x) => h("li", { text: `${x.field}: ${x.message}` }))) : null));
}
const fromApi = (r, okMsg) => ({ ok: r.ok, message: r.ok ? okMsg || r.data.message : r.data?.message || "Request failed", errors: r.data?.errors });

// ---------------------------------------------------------------- auth app
page({
  id: "auth", group: "apps", title: "Login, register & OTP",
  blurb: "A complete account flow backed by the real API: register, log in, reset password, one-time passcode and a profile page.",
  tasks: ["Register a new account, then log in with it.", "Try duplicate email, short password and mismatched confirmation.", "Log in with the demo account and assert the profile page.", "Request an OTP, read it from the page and verify it (third wrong try locks you out).", "Reuse the token from localStorage in an API test (key: ty.token).", "Log out and assert the protected view is gone."],
  render(root) {
    const host = h("div");
    const draw = () => (auth.user ? profile() : tabs());
    const redraw = () => host.replaceChildren(draw());

    function tabs() {
      const names = ["Login", "Register", "Forgot password", "One-time password"];
      const panels = [login(), register(), forgot(), otp()];
      const tabBtns = names.map((n, i) => h("button", { role: "tab", "aria-selected": String(i === 0), "data-testid": "tab-" + n.toLowerCase().replace(/\W+/g, "-") }, n));
      const wrap = h("div", { class: "tabs" }, h("div", { role: "tablist" }, tabBtns), panels.map((p, i) => h("div", { role: "tabpanel", hidden: i !== 0 }, p)));
      tabBtns.forEach((b, i) => b.addEventListener("click", () => { tabBtns.forEach((x, j) => x.setAttribute("aria-selected", String(i === j))); $$("[role=tabpanel]", wrap).forEach((p, j) => (p.hidden = i !== j)); }));
      return stage(wrap, h("p", { class: "hint" }, "Demo account: ", h("code", { text: DEMO.email }), " / ", h("code", { text: DEMO.password })));
    }
    const login = () => form("login", [{ name: "email", label: "Email", type: "email", autocomplete: "username" }, { name: "password", label: "Password", type: "password", autocomplete: "current-password" }], "Log in", async (v) => {
      const r = await api("POST", "/api/auth/login", v, { auth: false });
      if (r.ok) { auth.set(r.data.data.token, { id: r.data.data.id, name: r.data.data.name, email: r.data.data.email }); toast("Logged in", "ok"); return null; }
      return fromApi(r);
    });
    const register = () => form("register", [{ name: "name", label: "Full name" }, { name: "email", label: "Email", type: "email" }, { name: "password", label: "Password", type: "password", autocomplete: "new-password" }, { name: "confirm", label: "Confirm password", type: "password", autocomplete: "new-password" }], "Create account", async (v, f) => {
      if (v.password !== v.confirm) return { ok: false, message: "Passwords do not match" };
      const r = await api("POST", "/api/auth/register", { name: v.name, email: v.email, password: v.password }, { auth: false });
      if (r.ok) f.reset();
      return fromApi(r, "Account created — you can now log in.");
    });
    const forgot = () => form("forgot", [{ name: "email", label: "Email", type: "email" }], "Send reset link", async (v) => fromApi(await api("POST", "/api/auth/forgot", v, { auth: false })));
    const otp = () => {
      const wrap = h("div"); const info = h("div", { "data-testid": "otp-info" });
      const step2 = h("div", { hidden: true });
      const f1 = form("otp-request", [{ name: "email", label: "Email", type: "email", value: DEMO.email }], "Send code", async (v) => {
        const r = await api("POST", "/api/auth/otp/request", v, { auth: false });
        if (!r.ok) return fromApi(r);
        info.replaceChildren(h("div", { class: "alert info" }, "Practice mode — your code is ", h("b", { "data-testid": "otp-value", text: r.data.data.otp })));
        step2.hidden = false; step2.dataset.email = v.email; return { ok: true, message: "Code generated (expires in 2 minutes, 3 tries)" };
      });
      const f2 = form("otp-verify", [{ name: "otp", label: "6-digit code", placeholder: "123456" }], "Verify", async (v) => {
        const r = await api("POST", "/api/auth/otp/verify", { email: step2.dataset.email, otp: v.otp }, { auth: false });
        if (r.ok) { auth.set(r.data.data.token, { id: r.data.data.id, name: r.data.data.name, email: r.data.data.email }); return null; }
        return fromApi(r);
      });
      step2.append(h("hr"), f2); wrap.append(f1, info, step2); return wrap;
    };

    function profile() {
      const u = auth.user;
      const f = form("profile", [{ name: "displayName", label: "Display name", value: u.name }], "Update name", async (v) => {
        const r = await api("PATCH", "/api/auth/profile", { name: v.displayName });
        if (r.status === 401) { auth.clear(); return null; }
        if (r.ok) { auth.set(auth.token, { ...u, name: r.data.data.name }); toast("Profile updated", "ok"); return null; }
        return fromApi(r);
      });
      return stage(h("div", { "data-testid": "profile-card" }, h("div", { class: "eyebrow", text: "Logged in" }), h("h2", { "data-testid": "profile-name", text: u.name }), h("p", { class: "muted", "data-testid": "profile-email", text: u.email })), f,
        h("div", { class: "row", style: { marginTop: "16px" } }, h("button", { class: "btn", type: "button", "data-testid": "logout", onClick: async () => { await api("POST", "/api/auth/logout"); auth.clear(); toast("Logged out", "info"); } }, "Log out")));
    }
    host.append(draw());
    root.append(host);
    window.addEventListener("ty-auth", redraw);
    return () => window.removeEventListener("ty-auth", redraw);
  },
});

// ---------------------------------------------------------------- notes app
page({
  id: "notes", group: "apps", title: "Notes app",
  blurb: "A task and note manager (create, edit, complete, filter, search, delete) talking to the authenticated Notes API.",
  tasks: ["Log in, create notes in all three categories and assert the counters.", "Submit an empty title and assert the API validation message.", "Mark a note complete and verify with GET /api/notes/:id.", "Edit a note through the dialog, delete another, then search.", "Seed 10 notes through the API and verify the UI shows them after reload."],
  render(root) {
    const host = h("div");
    let notes = [], cat = "All", q = "";
    const load = async () => { const r = await api("GET", "/api/notes"); if (r.status === 401) { auth.clear(); return; } notes = r.ok ? r.data.data : []; draw(); };

    function gate() {
      return stage(h("div", { class: "alert warn", "data-testid": "notes-gate" }, "You need to be logged in to use the notes app."), h("div", { class: "row", style: { marginTop: "12px" } },
        h("a", { class: "btn", href: "/practice/auth", "data-testid": "go-login" }, "Go to login"),
        h("button", { class: "btn primary", type: "button", "data-testid": "quick-login", onClick: async () => { const r = await api("POST", "/api/auth/login", DEMO, { auth: false }); if (r.ok) auth.set(r.data.data.token, { id: r.data.data.id, name: r.data.data.name, email: r.data.data.email }); } }, "Quick login (demo account)")));
    }
    function draw() {
      if (!auth.token) { host.replaceChildren(gate()); return; }
      const shown = notes.filter((n) => (cat === "All" || n.category === cat) && (!q || (n.title + n.description).toLowerCase().includes(q.toLowerCase())));
      const counts = { All: notes.length, Home: 0, Work: 0, Personal: 0 }; notes.forEach((n) => counts[n.category]++);
      const msg = h("div", { "data-testid": "note-msg" });
      const nf = h("form", { novalidate: true, "data-testid": "note-form" },
        h("div", { class: "grid g3" }, field("Title", h("input", { name: "title", "data-testid": "note-title" })), field("Category", h("select", { name: "category", "data-testid": "note-category" }, ["Home", "Work", "Personal"].map((c) => h("option", { value: c, text: c })))), field("Description", h("input", { name: "description", "data-testid": "note-desc" }))),
        h("button", { class: "btn primary", type: "submit", "data-testid": "note-add" }, "Add note"), h("div", { style: { marginTop: "10px" } }, msg));
      nf.addEventListener("submit", async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(nf)); const r = await api("POST", "/api/notes", v); if (r.ok) { nf.reset(); await load(); toast("Note added", "ok", 1500); } else show(msg, false, r.data.message, r.data.errors); });
      const card = (n) => h("div", { class: "shop-card", "data-testid": "note-card", "data-id": n.id, style: { opacity: n.completed ? ".65" : 1 } },
        h("div", { class: "row", style: { justifyContent: "space-between" } }, h("label", { class: "check" }, h("input", { type: "checkbox", checked: n.completed, "aria-label": "Completed", "data-testid": "note-done", onChange: async (e) => { await api("PATCH", "/api/notes/" + n.id, { completed: e.target.checked }); load(); } }), h("b", { "data-testid": "note-title-text", style: { textDecoration: n.completed ? "line-through" : "" }, text: n.title })), h("span", { class: "tag acc", text: n.category })),
        h("p", { class: "muted", style: { margin: 0 }, text: n.description || "No description" }),
        h("div", { class: "row" }, h("button", { class: "btn sm", type: "button", "data-testid": "note-edit", onClick: () => edit(n) }, "Edit"), h("button", { class: "btn sm danger", type: "button", "data-testid": "note-delete", onClick: async () => { await api("DELETE", "/api/notes/" + n.id); load(); } }, "Delete")));
      host.replaceChildren(
        stage(h("h2", { text: "New note" }), nf),
        stage(h("div", { class: "row", style: { marginBottom: "14px" } }, ["All", "Home", "Work", "Personal"].map((c) => h("button", { class: "btn sm" + (cat === c ? " primary" : ""), type: "button", "data-testid": "filter-" + c.toLowerCase(), onClick: () => { cat = c; draw(); } }, `${c} (${counts[c]})`)), h("input", { type: "search", placeholder: "Search notes…", value: q, style: { maxWidth: "220px", marginLeft: "auto" }, "data-testid": "note-search", onInput: (e) => { q = e.target.value; const pos = e.target.selectionStart; draw(); const s = $("[data-testid=note-search]", host); s.focus(); s.setSelectionRange(pos, pos); } })),
          shown.length ? h("div", { class: "grid g3", "data-testid": "note-list" }, shown.map(card)) : h("p", { class: "muted", "data-testid": "note-empty", text: "No notes to show." })));
    }
    function edit(n) {
      const t = h("input", { value: n.title, "data-testid": "edit-title" }), d = h("input", { value: n.description, "data-testid": "edit-desc" }), err = h("div", { class: "err" });
      modal({ title: "Edit note", body: h("div", {}, field("Title", t), field("Description", d), err), actions: [{ label: "Cancel" }, { label: "Save", primary: true, onClick: async () => { const r = await api("PATCH", "/api/notes/" + n.id, { title: t.value, description: d.value }); r.ok ? load() : toast(r.data.message, "bad"); } }] });
    }
    root.append(host);
    const onAuth = () => (auth.token ? load() : draw());
    window.addEventListener("ty-auth", onAuth);
    auth.token ? load() : draw();
    return () => window.removeEventListener("ty-auth", onAuth);
  },
});

// ---------------------------------------------------------------- shop
page({
  id: "shop", group: "apps", title: "E-commerce shop",
  blurb: "Search, filter, sort and paginate products from the API, manage a cart and check out to create a real order.",
  tasks: ["Search “book”, filter by category and sort by price.", "Add three products, change a quantity and remove one; assert subtotal and shipping.", "Spend ≥ $75 and assert shipping becomes free.", "Check out with invalid email, then valid data; read the order id.", "Verify the order via GET /api/orders/:id."],
  render(root) {
    let cart = store.get("cart", {}), f = { search: "", category: "", sort: "", page: 1 }, products = [], meta = {}, all = [];
    const prodHost = h("div"), cartHost = h("div"), pager = h("div", { class: "pager" });
    const saveCart = () => { store.set("cart", cart); drawCart(); };
    const load = async () => {
      const qs = new URLSearchParams({ limit: 6, page: f.page, ...(f.search && { search: f.search }), ...(f.category && { category: f.category }), ...(f.sort && { sort: f.sort }) });
      const r = await api("GET", "/api/products?" + qs, undefined, { auth: false });
      if (!r.ok) { prodHost.replaceChildren(h("div", { class: "alert bad", text: "Could not load products. Is the API running?" })); return; }
      products = r.data.data; meta = r.data; products.forEach((p) => (all[p.id] = p)); drawProducts();
    };
    const drawProducts = () => {
      prodHost.replaceChildren(products.length ? h("div", { class: "grid g3", "data-testid": "product-grid" }, products.map((p) => h("div", { class: "shop-card", "data-testid": "product-card", "data-id": p.id },
        h("div", { class: "emoji", text: p.emoji }), h("b", { "data-testid": "product-name", text: p.name }), h("span", { class: "muted", text: `${p.category} · ★ ${p.rating}` }),
        h("div", { class: "row", style: { justifyContent: "space-between" } }, h("b", { "data-testid": "product-price", text: money(p.price) }), h("span", { class: "tag " + (p.stock < 5 ? "warn" : "ok"), text: p.stock + " in stock" })),
        h("button", { class: "btn primary", type: "button", disabled: p.stock < 1, "data-testid": "add-to-cart", onClick: () => { cart[p.id] = Math.min(10, (cart[p.id] || 0) + 1); saveCart(); toast(p.name + " added", "ok", 1200); } }, "Add to cart")))) : h("p", { class: "muted", "data-testid": "no-products", text: "No products found." }));
      pager.replaceChildren(...Array.from({ length: meta.total_pages || 1 }, (_, i) => h("button", { class: "btn sm", type: "button", "aria-current": String(i + 1 === f.page), "data-testid": "shop-page-" + (i + 1), onClick: () => { f.page = i + 1; load(); } }, String(i + 1))));
    };
    const lines = () => Object.entries(cart).map(([id, qty]) => ({ p: all[id], id: +id, qty })).filter((l) => l.p);
    const drawCart = async () => {
      // make sure we know every product in the cart
      for (const id of Object.keys(cart)) if (!all[id]) { const r = await api("GET", "/api/products/" + id, undefined, { auth: false }); if (r.ok) all[id] = r.data.data; else delete cart[id]; }
      const ls = lines(), sub = ls.reduce((s, l) => s + l.p.price * l.qty, 0), ship = !ls.length ? 0 : sub >= 75 ? 0 : 5.99;
      cartHost.replaceChildren(stage(h("h2", { text: "Cart" }), ls.length ? [
        ...ls.map((l) => h("div", { class: "row", style: { justifyContent: "space-between", marginBottom: "8px" }, "data-testid": "cart-line" }, h("span", { text: l.p.name }), h("span", { class: "row" },
          h("button", { class: "btn sm", type: "button", "aria-label": "Decrease", "data-testid": "qty-dec", onClick: () => { cart[l.id] = Math.max(1, l.qty - 1); saveCart(); } }, "−"), h("b", { "data-testid": "qty", text: l.qty }), h("button", { class: "btn sm", type: "button", "aria-label": "Increase", "data-testid": "qty-inc", onClick: () => { cart[l.id] = Math.min(10, l.qty + 1); saveCart(); } }, "+"),
          h("button", { class: "btn sm danger", type: "button", "aria-label": "Remove", "data-testid": "cart-remove", onClick: () => { delete cart[l.id]; saveCart(); } }, "✕")))),
        h("hr"), h("div", { class: "row", style: { justifyContent: "space-between" } }, "Subtotal", h("b", { "data-testid": "subtotal", text: money(sub) })),
        h("div", { class: "row", style: { justifyContent: "space-between" } }, "Shipping", h("b", { "data-testid": "shipping", text: ship ? money(ship) : "FREE" })),
        h("div", { class: "row", style: { justifyContent: "space-between", fontSize: "1.15rem" } }, "Total", h("b", { "data-testid": "total", text: money(sub + ship) })),
        h("button", { class: "btn primary", type: "button", style: { marginTop: "12px", width: "100%" }, "data-testid": "checkout", onClick: checkout }, "Checkout")] : h("p", { class: "muted", "data-testid": "cart-empty", text: "Your cart is empty." })));
    };
    function checkout() {
      const n = h("input", { name: "name", "data-testid": "co-name" }), e = h("input", { name: "email", type: "email", "data-testid": "co-email" }), a = h("input", { name: "address", "data-testid": "co-address" }), err = h("div", { "data-testid": "co-msg" });
      const m = modal({ title: "Checkout", body: h("div", {}, field("Full name", n), field("Email", e), field("Address", a), err), actions: [{ label: "Cancel" }] });
      const place = h("button", { class: "btn primary", type: "button", "data-testid": "place-order", onClick: async () => {
        const r = await api("POST", "/api/orders", { items: lines().map((l) => ({ productId: l.id, qty: l.qty })), customer: { name: n.value, email: e.value, address: a.value } }, { auth: false });
        if (!r.ok) { show(err, false, r.data.message, r.data.errors); return; }
        m.close(); cart = {}; saveCart(); load();
        modal({ title: "Order confirmed 🎉", body: h("div", {}, h("p", {}, "Order number: ", h("b", { "data-testid": "order-id", text: String(r.data.data.id) })), h("p", { "data-testid": "order-total", text: "Total charged: " + money(r.data.data.total) })), actions: [{ label: "Done", primary: true }] });
      } }, "Place order");
      m.el.querySelector(".row").prepend(place);
    }
    const search = h("input", { type: "search", placeholder: "Search products…", "data-testid": "shop-search", style: { maxWidth: "220px" }, onInput: (e) => { f.search = e.target.value; f.page = 1; clearTimeout(search._t); search._t = setTimeout(load, 250); } });
    const cat = h("select", { style: { width: "auto" }, "aria-label": "Category", "data-testid": "shop-category", onChange: (e) => { f.category = e.target.value; f.page = 1; load(); } }, h("option", { value: "", text: "All categories" }), ["Electronics", "Books", "Home", "Clothing"].map((c) => h("option", { value: c, text: c })));
    const sort = h("select", { style: { width: "auto" }, "aria-label": "Sort", "data-testid": "shop-sort", onChange: (e) => { f.sort = e.target.value; load(); } }, [["", "Sort: featured"], ["price", "Price: low → high"], ["-price", "Price: high → low"], ["rating", "Top rated"], ["name", "Name A–Z"]].map(([v, l]) => h("option", { value: v, text: l })));
    root.append(h("div", { style: { display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: "18px", alignItems: "start" }, class: "shop-layout" },
      h("div", {}, stage(h("div", { class: "row", style: { marginBottom: "14px" } }, search, cat, sort), prodHost, pager)), cartHost));
    const st = document.createElement("style"); st.textContent = "@media(max-width:900px){.shop-layout{grid-template-columns:1fr!important}}"; root.append(st);
    load(); drawCart();
  },
});

// ---------------------------------------------------------------- flight booking
page({
  id: "flights", group: "apps", title: "Flight booking wizard",
  blurb: "A four-step end-to-end flow: search, choose, passenger details and payment, with validation at every step.",
  tasks: ["Search with the same origin and destination and assert the error.", "Book 2 passengers and assert two passenger forms appear.", "Choose the cheapest flight and carry its price to the review step.", "Pay with an invalid card number, then a valid one (4242 4242 4242 4242).", "Assert the booking reference format TY-XXXXXX."],
  render(root) {
    const AIR = ["Delhi (DEL)", "Mumbai (BOM)", "London (LHR)", "New York (JFK)", "Singapore (SIN)", "Dubai (DXB)"];
    const s = { step: 1, from: "", to: "", date: "", pax: 1, trip: "oneway", flight: null, paxData: [] };
    const host = h("div");
    const steps = () => h("ol", { class: "steps", style: { padding: 0, margin: "0 0 18px" }, "data-testid": "wizard-steps" }, ["Search", "Choose flight", "Passengers", "Payment"].map((n, i) => h("li", { class: s.step === i + 1 ? "on" : s.step > i + 1 ? "done" : "", "aria-current": s.step === i + 1 ? "step" : null, text: `${i + 1}. ${n}` })));
    const err = (id) => h("div", { class: "err", role: "alert", "data-testid": id });
    const seededFlights = () => { let x = [...(s.from + s.to + s.date)].reduce((a, c) => a + c.charCodeAt(0), 0); const r = () => (x = (x * 9301 + 49297) % 233280) / 233280; return Array.from({ length: 5 }, (_, i) => ({ id: "TY" + (100 + i * 7), dep: `${String(5 + i * 3).padStart(2, "0")}:${["00", "30", "15", "45", "10"][i]}`, dur: 2 + Math.floor(r() * 9), price: Math.round((120 + r() * 600) * 100) / 100, stops: i % 3 === 0 ? 0 : 1 })); };
    function draw() {
      host.replaceChildren(stage(steps(), [step1, step2, step3, step4][s.step - 1]()));
    }
    function step1() {
      const from = h("select", { "data-testid": "from" }, h("option", { value: "", text: "Select origin" }), AIR.map((a) => h("option", { value: a, text: a, selected: s.from === a }))), to = h("select", { "data-testid": "to" }, h("option", { value: "", text: "Select destination" }), AIR.map((a) => h("option", { value: a, text: a, selected: s.to === a })));
      const date = h("input", { type: "date", "data-testid": "depart", value: s.date, min: new Date().toISOString().slice(0, 10) });
      const pax = h("input", { type: "number", min: "1", max: "4", value: s.pax, "data-testid": "pax" });
      const e = err("search-error");
      const trip = ["oneway", "round"].map((t) => h("label", { class: "check" }, h("input", { type: "radio", name: "trip", value: t, checked: s.trip === t, "data-testid": "trip-" + t, onChange: () => (s.trip = t) }), t === "oneway" ? "One way" : "Round trip"));
      return h("div", {}, h("div", { class: "grid g2" }, field("From", from), field("To", to), field("Departure", date), field("Passengers (1–4)", pax)), h("div", { class: "row" }, trip),
        h("div", { class: "row", style: { marginTop: "14px" } }, h("button", { class: "btn primary", type: "button", "data-testid": "search", onClick: () => {
          const msg = !from.value || !to.value ? "Choose both origin and destination" : from.value === to.value ? "Origin and destination must differ" : !date.value ? "Choose a departure date" : +pax.value < 1 || +pax.value > 4 ? "Passengers must be between 1 and 4" : "";
          if (msg) { e.textContent = msg; return; }
          Object.assign(s, { from: from.value, to: to.value, date: date.value, pax: +pax.value }); s.step = 2; draw();
        } }, "Search flights")), e);
    }
    function step2() {
      const fl = seededFlights();
      return h("div", {}, h("p", { class: "muted", "data-testid": "route", text: `${s.from} → ${s.to} · ${s.date} · ${s.pax} passenger(s)` }), h("div", { class: "stack" }, fl.map((f) => h("div", { class: "shop-card", "data-testid": "flight", style: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } },
        h("div", {}, h("b", { text: f.id }), h("div", { class: "muted", text: `Departs ${f.dep} · ${f.dur}h · ${f.stops ? "1 stop" : "non-stop"}` })), h("div", { class: "row" }, h("b", { "data-testid": "flight-price", text: money(f.price) }), h("button", { class: "btn primary", type: "button", "data-testid": "select-flight", onClick: () => { s.flight = f; s.step = 3; draw(); } }, "Select"))))),
        h("div", { style: { marginTop: "12px" } }, h("button", { class: "btn", type: "button", "data-testid": "back", onClick: () => { s.step = 1; draw(); } }, "← Back")));
    }
    function step3() {
      const rows = Array.from({ length: s.pax }, (_, i) => ({ n: h("input", { value: s.paxData[i]?.name || "", "data-testid": `pax-name-${i + 1}` }), e: h("input", { type: "email", value: s.paxData[i]?.email || "", "data-testid": `pax-email-${i + 1}` }) }));
      const e = err("pax-error");
      return h("div", {}, rows.map((r, i) => h("div", { class: "grid g2" }, field(`Passenger ${i + 1} name`, r.n), field(`Passenger ${i + 1} email`, r.e))), e,
        h("div", { class: "row", style: { marginTop: "12px" } }, h("button", { class: "btn", type: "button", onClick: () => { s.step = 2; draw(); } }, "← Back"), h("button", { class: "btn primary", type: "button", "data-testid": "to-payment", onClick: () => {
          if (rows.some((r) => r.n.value.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.e.value))) { e.textContent = "Enter a name and a valid email for every passenger"; return; }
          s.paxData = rows.map((r) => ({ name: r.n.value.trim(), email: r.e.value })); s.step = 4; draw();
        } }, "Continue to payment")));
    }
    function step4() {
      const total = Math.round(s.flight.price * s.pax * 100) / 100;
      const card = h("input", { placeholder: "4242 4242 4242 4242", inputmode: "numeric", "data-testid": "card" }), exp = h("input", { placeholder: "MM/YY", "data-testid": "exp" }), cvc = h("input", { placeholder: "CVC", "data-testid": "cvc", maxlength: "4" });
      const e = err("pay-error");
      return h("div", {}, h("div", { class: "alert info", "data-testid": "review" }, `${s.flight.id} · ${s.from} → ${s.to} · ${s.pax} × ${money(s.flight.price)} = `, h("b", { "data-testid": "review-total", text: money(total) })),
        h("div", { class: "grid g3", style: { marginTop: "14px" } }, field("Card number", card), field("Expiry", exp), field("CVC", cvc)), e,
        h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: () => { s.step = 3; draw(); } }, "← Back"), h("button", { class: "btn primary", type: "button", "data-testid": "pay", onClick: async () => {
          const digits = card.value.replace(/\s/g, "");
          if (!/^\d{16}$/.test(digits)) { e.textContent = "Card number must be 16 digits"; return; }
          if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp.value)) { e.textContent = "Expiry must be MM/YY"; return; }
          if (!/^\d{3,4}$/.test(cvc.value)) { e.textContent = "CVC must be 3 or 4 digits"; return; }
          if (digits.startsWith("4000")) { e.textContent = "Card declined by issuer"; return; }
          e.textContent = ""; await sleep(900);
          const ref = "TY-" + Math.random().toString(36).slice(2, 8).toUpperCase();
          host.replaceChildren(stage(h("div", { class: "alert ok", "data-testid": "booking-confirmed" }, "Booking confirmed! Reference: ", h("b", { "data-testid": "booking-ref", text: ref })), h("p", { class: "muted", text: `Confirmation sent to ${s.paxData[0].email}` }), h("button", { class: "btn", type: "button", "data-testid": "new-booking", onClick: () => { Object.assign(s, { step: 1, flight: null, paxData: [] }); draw(); } }, "Book another")));
        } }, "Pay " + money(total))), h("p", { class: "hint", text: "Card starting 4000 is always declined." }));
    }
    root.append(host); draw();
  },
});

// ---------------------------------------------------------------- mini apps
page({
  id: "miniapps", group: "apps", title: "Mini apps: BMI, password, tips",
  blurb: "Three small calculators with clear business rules — ideal for boundary-value and equivalence-class testing.",
  tasks: ["BMI: test 18.4 / 18.5 / 24.9 / 25 / 29.9 / 30 and invalid inputs.", "Password checker: assert each rule and the strength label.", "Tip splitter: 0 people, negative bill, 15% of 100 for 3 people.", "Write a data-driven test with a table of inputs and expected outputs."],
  render(root) {
    // BMI
    const hgt = h("input", { type: "number", "data-testid": "bmi-height", placeholder: "cm" }), wgt = h("input", { type: "number", "data-testid": "bmi-weight", placeholder: "kg" });
    const bmiOut = h("div", { "data-testid": "bmi-out", role: "status" });
    const bmi = h("div", {}, h("div", { class: "grid g2" }, field("Height (cm)", hgt), field("Weight (kg)", wgt)), h("button", { class: "btn primary", type: "button", "data-testid": "bmi-calc", onClick: () => {
      const hm = +hgt.value / 100, w = +wgt.value;
      if (!(hm > 0.5 && hm < 2.6) || !(w > 10 && w < 400)) { bmiOut.replaceChildren(h("div", { class: "alert bad", text: "Enter height 50–260 cm and weight 10–400 kg" })); return; }
      const v = w / (hm * hm), cat = v < 18.5 ? ["Underweight", "warn"] : v < 25 ? ["Normal", "ok"] : v < 30 ? ["Overweight", "warn"] : ["Obese", "bad"];
      bmiOut.replaceChildren(h("div", { class: "alert " + cat[1] }, "BMI ", h("b", { "data-testid": "bmi-value", text: v.toFixed(1) }), " — ", h("b", { "data-testid": "bmi-cat", text: cat[0] })));
    } }, "Calculate"), h("div", { style: { marginTop: "12px" } }, bmiOut));
    // password
    const pw = h("input", { type: "text", "data-testid": "pw-input", placeholder: "Type a password", autocomplete: "off" });
    const rules = [["At least 8 characters", (p) => p.length >= 8], ["Lowercase letter", (p) => /[a-z]/.test(p)], ["Uppercase letter", (p) => /[A-Z]/.test(p)], ["Digit", (p) => /\d/.test(p)], ["Symbol", (p) => /[^\w\s]/.test(p)]];
    const list = h("ul", { style: { listStyle: "none", padding: 0 }, "data-testid": "pw-rules" }), meter = h("div", { class: "bar" }, h("i")), label = h("b", { "data-testid": "pw-strength", text: "—" });
    const upd = () => { const p = pw.value; let n = 0; list.replaceChildren(...rules.map(([t, fn]) => { const ok = fn(p); n += ok; return h("li", { "data-ok": String(ok), text: (ok ? "✔ " : "✖ ") + t, style: { color: ok ? "var(--ok)" : "var(--muted)" } }); })); const lv = !p ? "—" : n <= 2 ? "Weak" : n <= 4 ? "Medium" : "Strong"; label.textContent = lv; meter.firstChild.style.width = (p ? (n / 5) * 100 : 0) + "%"; };
    pw.addEventListener("input", upd); upd();
    // tips
    const bill = h("input", { type: "number", value: "100", "data-testid": "tip-bill" }), pct = h("input", { type: "number", value: "15", "data-testid": "tip-pct" }), ppl = h("input", { type: "number", value: "3", "data-testid": "tip-people" }), tipOut = h("div", { "data-testid": "tip-out", role: "status" });
    const calc = () => { const b = +bill.value, t = +pct.value, n = +ppl.value; if (!(b >= 0) || !(t >= 0) || !(Number.isInteger(n) && n >= 1)) { tipOut.replaceChildren(h("div", { class: "alert bad", text: "Bill and tip must be ≥ 0 and people a whole number ≥ 1" })); return; } const total = b * (1 + t / 100); tipOut.replaceChildren(h("div", { class: "alert ok" }, "Total ", h("b", { "data-testid": "tip-total", text: money(total) }), " · Each pays ", h("b", { "data-testid": "tip-each", text: money(total / n) }))); };
    [bill, pct, ppl].forEach((x) => x.addEventListener("input", calc)); calc();
    root.append(h("div", { class: "grid g2" }, stage(h("h2", { text: "BMI calculator" }), bmi), stage(h("h2", { text: "Password strength" }), field("Password", pw), meter, h("p", {}, "Strength: ", label), list), stage(h("h2", { text: "Tip splitter" }), h("div", { class: "grid g3" }, field("Bill ($)", bill), field("Tip (%)", pct), field("People", ppl)), tipOut)));
  },
});
