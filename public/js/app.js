import { $, $$, h, store, toast, api } from "./ui.js";
import { INTRO, FAQ, HOME_TITLE, homeDescription, pageTitle, pageDescription } from "./content.js";
import { GROUPS, pages } from "./registry.js";
import "./pages/elements.js";
import "./pages/elements2.js";
import "./pages/tables.js";
import "./pages/dynamic.js";
import "./pages/apps.js";
import "./pages/api.js";
import "./pages/learn.js";

const main = $("#main");
const nav = $("#nav");
let cleanup = null;
let done = new Set(store.get("done", []));
const saveDone = () => store.set("done", [...done]);
const visible = () => pages.filter((p) => !p.hidden);

// ---------- navigation ----------
const closed = new Set(store.get("closedGroups", []));
function buildNav(filter = "") {
  const q = filter.trim().toLowerCase();
  nav.replaceChildren();
  for (const g of GROUPS) {
    const items = visible().filter((p) => p.group === g.id && (!q || (p.title + " " + p.blurb + " " + g.title).toLowerCase().includes(q)));
    if (!items.length) continue;
    const isClosed = !q && closed.has(g.id);
    const grp = h("div", { class: "grp" + (isClosed ? " closed" : ""), "data-testid": "group-" + g.id });
    grp.append(
      h("button", { type: "button", "aria-expanded": String(!isClosed), onClick: () => { closed.has(g.id) ? closed.delete(g.id) : closed.add(g.id); store.set("closedGroups", [...closed]); buildNav($("#nav-search").value); } },
        h("span", { text: g.title }), h("span", { class: "chev", "aria-hidden": "true", text: "▾" })),
      h("ul", {}, items.map((p) => h("li", {}, h("a", { href: "/practice/" + p.id, "data-testid": "nav-" + p.id, ...(location.pathname === "/practice/" + p.id ? { "aria-current": "page" } : {}) },
        h("span", { class: "dot" + (done.has(p.id) ? " done" : ""), "aria-hidden": "true" }), p.title)))));
    nav.append(grp);
  }
  if (!nav.children.length) nav.append(h("p", { class: "muted", style: { padding: "10px" }, text: "No pages match." }));
}
$("#nav-search").addEventListener("input", (e) => buildNav(e.target.value));
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) { e.preventDefault(); $("#nav-search").focus(); }
});
$("#menu-btn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
$("#scrim").addEventListener("click", () => document.body.classList.remove("nav-open"));
$("#theme-btn").addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("ty.theme", next); } catch { /* ignore */ }
});
$("#reset-progress").addEventListener("click", () => { done = new Set(); saveDone(); buildNav($("#nav-search").value); route(); toast("Progress reset", "ok"); });

// ---------- pages ----------
function frame(def) {
  const g = GROUPS.find((x) => x.id === def.group);
  const mark = h("button", { class: "btn" + (done.has(def.id) ? "" : " primary"), type: "button", "data-testid": "mark-done" }, done.has(def.id) ? "✓ Practiced — undo" : "Mark as practiced");
  mark.addEventListener("click", () => {
    done.has(def.id) ? done.delete(def.id) : done.add(def.id);
    saveDone();
    mark.textContent = done.has(def.id) ? "✓ Practiced — undo" : "Mark as practiced";
    mark.classList.toggle("primary", !done.has(def.id));
    buildNav($("#nav-search").value);
  });
  const body = h("div", { "data-testid": "page-body" });
  const wrap = h("article", { "data-testid": "page-" + def.id },
    h("header", { class: "page-head" }, h("div", { class: "eyebrow", text: g?.title || "" }), h("h1", { text: def.title, "data-testid": "page-title" }), h("p", { text: def.blurb })),
    def.tasks?.length ? h("details", { class: "tasks", "data-testid": "tasks", open: true }, h("summary", { text: `Practice tasks (${def.tasks.length})` }), h("ul", {}, def.tasks.map((t) => h("li", { text: t })))) : null,
    body,
    def.hidden ? null : h("div", { class: "page-foot" }, mark));
  return { wrap, body };
}

function home() {
  const total = visible().length;
  const doneCount = visible().filter((p) => done.has(p.id)).length;
  const el = h("div", { "data-testid": "page-home" },
    h("section", { class: "hero" },
      h("div", { class: "eyebrow", text: "Free · open source · no sign-up" }),
      h("h1", {}, "Free QA practice website for ", h("em", { text: "test automation" })),
      h("p", { text: INTRO }),
      h("div", { class: "row" },
        h("a", { class: "btn primary", href: "/practice/inputs", "data-testid": "start-btn" }, "Start with web elements"),
        h("a", { class: "btn", href: "/practice/api-docs", "data-testid": "start-api" }, "Explore the API"),
        h("a", { class: "btn", href: "/practice/frameworks", "data-testid": "start-fw" }, "Build a framework")),
      h("div", { class: "stat" },
        h("div", {}, h("b", { text: String(total), "data-testid": "stat-pages" }), h("span", { text: "practice pages" })),
        h("div", {}, h("b", { text: String(doneCount), "data-testid": "stat-done" }), h("span", { text: "practiced" })),
        h("div", {}, h("b", { text: String(GROUPS.length) }), h("span", { text: "categories" })))),
    h("div", { class: "cards" }, GROUPS.map((g) => {
      const list = visible().filter((p) => p.group === g.id);
      const n = list.filter((p) => done.has(p.id)).length;
      return h("a", { class: "card", href: "/practice/" + list[0].id, "data-testid": "card-" + g.id },
        h("h3", { text: g.title }), h("p", { text: g.blurb }),
        h("div", { class: "bar", role: "progressbar", "aria-valuenow": String(n), "aria-valuemax": String(list.length) }, h("i", { style: { width: (list.length ? (n / list.length) * 100 : 0) + "%" } })),
        h("small", { class: "muted", text: `${n} / ${list.length} practiced` }));
    })),
    h("section", { style: { marginTop: "44px" } }, h("h2", { text: "Frequently asked questions" }), FAQ.map(([q, a]) => h("div", {}, h("h3", { text: q }), h("p", { class: "muted", text: a })))));
  return el;
}

function setMeta(title, description, path) {
  document.title = title;
  const set = (sel, attr, val) => document.querySelector(sel)?.setAttribute(attr, val);
  const canon = document.querySelector('link[rel="canonical"]');
  const url = canon ? new URL(path, canon.href).href : location.origin + path;
  if (canon) canon.href = url;
  set('meta[name="description"]', "content", description);
  set('meta[property="og:title"]', "content", title); set('meta[name="twitter:title"]', "content", title);
  set('meta[property="og:description"]', "content", description); set('meta[name="twitter:description"]', "content", description);
  set('meta[property="og:url"]', "content", url);
}

function route() {
  if (typeof cleanup === "function") { try { cleanup(); } catch { /* ignore */ } }
  cleanup = null;
  document.body.classList.remove("nav-open");
  const path = location.pathname.replace(/\/+$/, "");
  const isHome = path === "";
  const id = path.startsWith("/practice/") ? path.slice("/practice/".length) : isHome ? "" : "\u0000not-found";
  const def = pages.find((p) => p.id === id);
  main.replaceChildren();
  $("#crumbs").textContent = "";
  const robots = document.querySelector('meta[name="robots"]');
  if (robots && !def && !isHome) robots.content = "noindex,follow";
  if (isHome) { $("#crumbs").textContent = "Home"; main.append(home()); setMeta(HOME_TITLE, homeDescription(visible().length), "/"); }
  else if (!def) {
    main.append(h("div", { "data-testid": "page-404" }, h("h1", { text: "Page not found" }), h("p", { text: "There is no page at this address." }), h("a", { class: "btn primary", href: "/" }, "Back home")));
    document.title = "Page not found | TestYard";
  } else {
    const g = GROUPS.find((x) => x.id === def.group);
    $("#crumbs").textContent = `${g?.title || ""}  /  ${def.title}`;
    setMeta(pageTitle(def), pageDescription(def), "/practice/" + def.id);
    const { wrap, body } = frame(def);
    main.append(wrap);
    try { cleanup = def.render(body); }
    catch (e) { console.error(e); body.append(h("div", { class: "alert bad", text: "This page failed to render: " + e.message })); }
  }
  buildNav($("#nav-search").value);
  window.scrollTo(0, 0);
  if (!isHome) main.focus({ preventScroll: true });
}
window.addEventListener("popstate", route);
// Keep clean URLs: same-origin links to / and /practice/* are handled without a full reload.
document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.("a[href]");
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || !(u.pathname === "/" || u.pathname.startsWith("/practice/"))) return;
  e.preventDefault();
  if (u.pathname !== location.pathname) history.pushState({}, "", u.pathname);
  route();
});

// ---------- API status ----------
async function ping() {
  const el = $("#api-status");
  const r = await api("GET", "/api/health", undefined, { auth: false });
  el.className = "pill " + (r.ok ? "up" : "down");
  el.textContent = r.ok ? "API online" : "API offline";
  el.title = r.ok ? "Sandbox API is reachable" : "API not reachable — run `npm start` or set TESTYARD_API_BASE in index.html";
}
ping();
buildNav();
route();
