// Tiny helpers shared by every page.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** h("div", {class:"x", onClick: fn, "data-testid":"y"}, child, "text") */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k === "html") el.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Client-side navigation to a same-origin path (history API). */
export function navigate(to) { history.pushState({}, "", to); window.dispatchEvent(new PopStateEvent("popstate")); }

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const pretty = (v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));
export const money = (n) => "$" + Number(n).toFixed(2);

export const store = {
  get(k, d) { try { const v = localStorage.getItem("ty." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ty." + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem("ty." + k); } catch { /* ignore */ } },
};

export function toast(msg, type = "info", ms = 3500) {
  const box = document.getElementById("toasts");
  const t = h("div", { class: "toast " + type, role: "alert", "data-testid": "toast" }, msg);
  box.append(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard", "ok", 1500); }
  catch { toast("Copy failed — select the text manually", "warn"); }
}

export function modal({ title, body, actions }) {
  const back = h("div", { class: "modal-back", "data-testid": "modal-backdrop" });
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  const prev = document.activeElement;
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title, "data-testid": "modal" },
    h("h2", { text: title }), typeof body === "string" ? h("p", { text: body }) : body,
    h("div", { class: "row end", style: { marginTop: "18px" } }, (actions || [{ label: "Close" }]).map((a) =>
      h("button", { class: "btn " + (a.primary ? "primary" : ""), type: "button", "data-testid": "modal-" + a.label.toLowerCase().replace(/\W+/g, "-"), onClick: () => { a.onClick?.(); close(); } }, a.label))));
  back.append(box);
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  document.addEventListener("keydown", onKey);
  document.body.append(back);
  box.querySelector("button")?.focus();
  return { close, el: box };
}

// ---- API client ----
const BASE = () => (window.TESTYARD_API_BASE || "").replace(/\/$/, "");
export function sandboxId() {
  let id = store.get("sandbox");
  if (!id) { id = "u" + Math.random().toString(36).slice(2, 10); store.set("sandbox", id); }
  return id;
}
export const auth = {
  get token() { return store.get("token", null); },
  get user() { return store.get("user", null); },
  set(token, user) { store.set("token", token); store.set("user", user); window.dispatchEvent(new Event("ty-auth")); },
  clear() { store.del("token"); store.del("user"); window.dispatchEvent(new Event("ty-auth")); },
};
export async function api(method, path, body, opts = {}) {
  const t0 = performance.now();
  const headers = { "X-Sandbox": sandboxId(), ...(opts.headers || {}) };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (opts.auth !== false && auth.token && !headers.Authorization) headers.Authorization = "Bearer " + auth.token;
  try {
    const res = await fetch(BASE() + path, { method, headers, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body), redirect: opts.redirect || "follow" });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, ok: res.ok, data, text, ms: Math.round(performance.now() - t0), headers: Object.fromEntries(res.headers), url: res.url };
  } catch (e) {
    return { status: 0, ok: false, data: { success: false, message: "Network error: is the API reachable? " + e.message }, text: "", ms: Math.round(performance.now() - t0), headers: {} };
  }
}

/** Standard "result" block: a JSON <pre> that tests can assert on. */
export const resultPre = (testid = "result") => h("pre", { "data-testid": testid, "aria-live": "polite" }, "—");

/** Practice page building blocks */
export const stage = (...kids) => h("section", { class: "stage" }, ...kids);
export const field = (label, control, hint, errId) => {
  const id = control.id || "f-" + Math.random().toString(36).slice(2, 7);
  control.id = id;
  return h("div", { class: "field" }, h("label", { for: id, text: label }), control, hint ? h("span", { class: "hint", text: hint }) : null, errId ? h("span", { class: "err", id: errId, "data-testid": errId, role: "alert" }) : null);
};
