import { page } from "../registry.js";
import { h, $, $$, toast, stage, field, api, auth, store, sandboxId, pretty, copy, navigate } from "../ui.js";

const BASE = () => (window.TESTYARD_API_BASE || "").replace(/\/$/, "");
const origin = () => BASE() || location.origin;
const COLORS = { GET: "ok", POST: "info", PUT: "warn", PATCH: "warn", DELETE: "bad" };

// ---------------------------------------------------------------- docs
page({
  id: "api-docs", group: "api", title: "API reference",
  blurb: "Every endpoint of the sandbox REST API, generated live from the OpenAPI document. Your data is private to your sandbox id.",
  tasks: ["Import /api/openapi.json into Postman, Insomnia or Bruno.", "Register, log in and call a protected endpoint with the bearer token.", "Send the same request with two different X-Sandbox headers and compare data.", "Cover each documented status code with at least one test.", "Reset your sandbox and assert the seed data returns."],
  render(root) {
    const sb = sandboxId();
    const host = h("div", { "data-testid": "docs-host" }, h("p", { class: "muted", text: "Loading reference…" }));
    root.append(
      stage(h("div", { class: "grid g2" },
        h("div", {}, h("div", { class: "label", text: "Base URL" }), h("div", { class: "row", style: { flexWrap: "nowrap" } }, h("code", { "data-testid": "base-url", style: { flex: 1, padding: "9px 11px" }, text: origin() + "/api" }), h("button", { class: "btn sm", type: "button", "data-testid": "copy-base", onClick: () => copy(origin() + "/api") }, "Copy")),
          h("p", { class: "hint", style: { marginTop: "8px" } }, "OpenAPI: ", h("a", { href: BASE() + "/api/openapi.json", target: "_blank", rel: "noopener", "data-testid": "openapi-link", text: "/api/openapi.json" }))),
        h("div", {}, h("div", { class: "label", text: "Your sandbox id (header X-Sandbox)" }), h("div", { class: "row", style: { flexWrap: "nowrap" } }, h("code", { "data-testid": "sandbox-id", style: { flex: 1, padding: "9px 11px" }, text: sb }), h("button", { class: "btn sm", type: "button", onClick: () => copy(sb) }, "Copy"), h("button", { class: "btn sm danger", type: "button", "data-testid": "reset-sandbox", onClick: async () => { const r = await api("POST", "/api/reset"); r.ok ? toast("Sandbox reset", "ok") : toast("Reset failed", "bad"); } }, "Reset")),
          h("p", { class: "hint", style: { marginTop: "8px" }, text: "Data is kept in memory for 2 hours per id. Use any id in Postman or tests." }))),
        h("div", { class: "alert info", style: { marginTop: "14px" } }, "Demo account: ", h("code", { text: "practice@testyard.dev" }), " / ", h("code", { text: "SecretPass1!" }), ". Limits: 600 requests/minute per IP, bodies up to 100 KB.")),
      host);
    (async () => {
      const r = await api("GET", "/api/openapi.json", undefined, { auth: false });
      if (!r.ok) { host.replaceChildren(h("div", { class: "alert bad", text: "Could not load the API document. Start the server with `npm start`." })); return; }
      const tags = {};
      for (const [path, ops] of Object.entries(r.data.paths)) for (const [m, op] of Object.entries(ops)) (tags[op.tags[0]] ||= []).push({ path, method: m.toUpperCase(), op });
      host.replaceChildren(...Object.entries(tags).map(([tag, items]) => stage(h("h2", { text: tag }), h("div", { class: "stack" }, items.map(({ path, method, op }) => {
        const body = op.requestBody?.content?.["application/json"]?.example;
        const det = h("details", { class: "acc-item", "data-testid": `op-${method}-${path}` },
          h("summary", { style: { cursor: "pointer", padding: "10px 14px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } }, h("span", { class: "tag " + (COLORS[method] || ""), style: { minWidth: "58px", textAlign: "center" }, text: method }), h("code", { text: path }), op.security ? h("span", { class: "tag warn", title: "Bearer token required", text: "🔒 auth" }) : null, h("span", { class: "muted", text: op.summary })),
          h("div", { style: { padding: "0 14px 14px" } },
            op.parameters?.length ? h("div", {}, h("div", { class: "label", text: "Parameters" }), h("ul", { class: "muted", style: { marginTop: "4px" } }, op.parameters.map((p) => h("li", {}, h("code", { text: p.name }), ` (${p.in})${p.description ? " — " + p.description : ""}`)))) : null,
            body ? h("div", {}, h("div", { class: "label", text: "Example body" }), h("pre", { text: pretty(body) })) : null,
            h("div", { class: "row", style: { margin: "10px 0" } }, Object.keys(op.responses).map((c) => h("span", { class: "tag " + (+c < 300 ? "ok" : +c < 500 ? "warn" : "bad"), text: c }))),
            h("button", { class: "btn sm primary", type: "button", "data-testid": "try-it", onClick: () => { store.set("console.prefill", { method, path: path.replace(/\{(\w+)\}/g, (_, k) => (k === "code" ? "200" : k === "ms" ? "500" : "1")), body: body ? pretty(body) : "", auth: !!op.security }); navigate("/practice/api-console"); } }, "Try it in the console →")));
        return det;
      })))));
    })();
  },
});

// ---------------------------------------------------------------- console
const parseHeaders = (txt) => Object.fromEntries(txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(":"); return i < 0 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
page({
  id: "api-console", group: "api", title: "Request console",
  blurb: "A Postman-style request builder built into the page: send requests, inspect responses and copy them as cURL.",
  tasks: ["POST /api/auth/login, copy the token and call GET /api/auth/profile with it.", "Send invalid JSON and assert the 400 error shape.", "Call /api/rate-limit-demo six times quickly and read Retry-After.", "Compare PUT vs PATCH on /api/users/1.", "Use /api/status/418 and /api/delay/2000 to test client timeouts."],
  render(root) {
    const pre = store.get("console.prefill", null); store.del("console.prefill");
    const method = h("select", { style: { width: "110px" }, "data-testid": "c-method", "aria-label": "Method" }, ["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => h("option", { value: m, text: m, selected: pre?.method === m })));
    const url = h("input", { type: "text", value: pre?.path || "/api/users?per_page=3", "data-testid": "c-url", "aria-label": "URL", spellcheck: "false" });
    const hdr = h("textarea", { rows: "4", "data-testid": "c-headers", spellcheck: "false", "aria-label": "Headers" });
    hdr.value = pre?.auth && auth.token ? `Authorization: Bearer ${auth.token}` : "";
    const body = h("textarea", { rows: "7", "data-testid": "c-body", spellcheck: "false", "aria-label": "Body", class: "mono" }); body.value = pre?.body || "";
    const status = h("span", { class: "tag", "data-testid": "c-status", text: "—" }), time = h("span", { class: "muted mono", "data-testid": "c-time" }), resHeaders = h("pre", { "data-testid": "c-res-headers", style: { maxHeight: "160px" } }, ""), resBody = h("pre", { "data-testid": "c-res-body" }, "Send a request to see the response here.");
    const curl = h("pre", { "data-testid": "c-curl", style: { maxHeight: "140px" } }, "");
    const hist = h("div", { class: "stack", "data-testid": "c-history" });
    let history = store.get("console.history", []);
    const buildCurl = () => {
      const hs = { "X-Sandbox": sandboxId(), ...parseHeaders(hdr.value) }; if (body.value.trim() && method.value !== "GET") hs["Content-Type"] ||= "application/json";
      const full = /^https?:/.test(url.value) ? url.value : origin() + (url.value.startsWith("/") ? "" : "/") + url.value;
      curl.textContent = `curl -i -X ${method.value} '${full}' \\\n` + Object.entries(hs).map(([k, v]) => `  -H '${k}: ${v}'`).join(" \\\n") + (body.value.trim() && method.value !== "GET" ? ` \\\n  -d '${body.value.replace(/'/g, "'\\''")}'` : "");
    };
    const drawHist = () => hist.replaceChildren(...history.slice(0, 8).map((x) => h("button", { class: "btn sm", type: "button", style: { textAlign: "left", display: "flex", gap: "8px" }, onClick: () => { method.value = x.method; url.value = x.url; body.value = x.body || ""; buildCurl(); } }, h("span", { class: "tag " + (x.status < 300 ? "ok" : x.status < 500 ? "warn" : "bad"), text: String(x.status) }), h("span", { class: "mono", text: `${x.method} ${x.url}` }))));
    const send = async () => {
      const hs = parseHeaders(hdr.value);
      let payload; if (body.value.trim() && method.value !== "GET") { payload = undefined; }
      const t0 = performance.now();
      status.textContent = "…"; status.className = "tag";
      let res;
      try {
        const full = /^https?:/.test(url.value) ? url.value : BASE() + (url.value.startsWith("/") ? "" : "/") + url.value;
        res = await fetch(full, { method: method.value, headers: { "X-Sandbox": sandboxId(), ...(body.value.trim() && method.value !== "GET" ? { "Content-Type": "application/json" } : {}), ...hs }, body: body.value.trim() && method.value !== "GET" ? body.value : undefined, redirect: "manual" });
        const text = await res.text();
        status.textContent = res.type === "opaqueredirect" ? "3xx (redirect not followed)" : `${res.status} ${res.statusText}`; status.className = "tag " + (res.status < 300 ? "ok" : res.status < 500 ? "warn" : "bad");
        time.textContent = Math.round(performance.now() - t0) + " ms";
        resHeaders.textContent = [...res.headers].map(([k, v]) => `${k}: ${v}`).join("\n");
        try { resBody.textContent = pretty(JSON.parse(text)); } catch { resBody.textContent = text || "(empty body)"; }
        history.unshift({ method: method.value, url: url.value, body: body.value, status: res.status }); history = history.slice(0, 20); store.set("console.history", history); drawHist();
      } catch (e) { status.textContent = "Network error"; status.className = "tag bad"; resBody.textContent = e.message; }
    };
    [method, url, hdr, body].forEach((x) => x.addEventListener("input", buildCurl));
    url.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
    root.append(h("div", { class: "grid g2", style: { alignItems: "start" } },
      stage(h("div", { class: "row", style: { flexWrap: "nowrap" } }, method, url, h("button", { class: "btn primary", type: "button", "data-testid": "c-send", onClick: send }, "Send")),
        h("div", { style: { marginTop: "14px" } }, field("Headers (one per line, Key: value)", hdr), h("div", { class: "row", style: { marginBottom: "12px", marginTop: "-6px" } }, h("button", { class: "btn sm", type: "button", "data-testid": "c-insert-token", onClick: () => { if (!auth.token) { toast("Log in first (Demo apps → Login)", "warn"); return; } hdr.value = (hdr.value ? hdr.value + "\n" : "") + "Authorization: Bearer " + auth.token; buildCurl(); } }, "Insert my token")), field("JSON body", body)),
        h("div", { class: "label", text: "cURL" }), curl, h("div", { class: "row", style: { marginTop: "8px" } }, h("button", { class: "btn sm", type: "button", "data-testid": "c-copy-curl", onClick: () => copy(curl.textContent) }, "Copy cURL")), h("div", { class: "label", style: { marginTop: "14px" }, text: "History" }), hist),
      stage(h("div", { class: "row" }, h("b", { text: "Response" }), status, time), h("div", { class: "label", style: { marginTop: "12px" }, text: "Headers" }), resHeaders, h("div", { class: "label", style: { marginTop: "12px" }, text: "Body" }), resBody)));
    buildCurl(); drawHist();
  },
});

// ---------------------------------------------------------------- challenges
const CHALLENGES = [
  ["Status & contracts", ["GET /api/health returns 200 and success=true.", "GET /api/users/9999 returns 404 with a JSON error body.", "PUT on /api/health returns 405 and an Allow header.", "Every error response has success=false, status and message."]],
  ["CRUD lifecycle", ["Create a user, read it back, PATCH its job, PUT-replace it, DELETE it (204), then assert 404.", "POST /api/users without a job returns 400 with errors[].field = job.", "GET /api/users?per_page=5&page=3 returns the right slice and total_pages."]],
  ["Authentication", ["Register → login → profile → logout, then assert the old token returns 401.", "Login with a wrong password returns 401, with a missing field returns 400.", "Call a protected endpoint with no token, a malformed token and an expired one.", "Request an OTP and verify it; verify a wrong code three times and expect 429."]],
  ["Data isolation", ["Create a note as user A and assert user B cannot read it (404).", "Use two X-Sandbox ids and prove their user lists are independent."]],
  ["Shop & orders", ["Order quantity 11 returns 400; unknown product returns 400.", "Order totals: subtotal, shipping (free ≥ $75) and total are consistent.", "Stock decreases after an order, visible in GET /api/products/:id."]],
  ["Resilience", ["GET /api/delay/3000 with a 1 s client timeout must fail gracefully.", "Retry /api/flaky?failRate=0.7 with back-off until success (max 5 attempts).", "Hit /api/rate-limit-demo six times: assert 429 and wait for Retry-After before the next call.", "Follow /api/redirect/3 and assert the redirect chain length."]],
  ["Files & headers", ["Download /api/files/sample.csv and assert Content-Disposition and the CSV header row.", "POST a multipart file to /api/upload and assert the returned size.", "GET /api/auth/basic with and without admin:admin credentials."]],
];
page({
  id: "api-challenges", group: "api", title: "API test challenges",
  blurb: "A checklist of API test ideas, from simple status checks to isolation and resilience. Tick them off as you automate them.",
  tasks: [],
  render(root) {
    const done = new Set(store.get("api.done", []));
    const total = CHALLENGES.reduce((s, c) => s + c[1].length, 0);
    const prog = h("p", { class: "mono", "data-testid": "api-progress" });
    const upd = () => (prog.textContent = `${done.size} / ${total} challenges done`);
    root.append(stage(prog), ...CHALLENGES.map(([t, items], gi) => stage(h("h2", { text: t }), items.map((x, i) => {
      const id = `${gi}.${i}`;
      return h("label", { class: "check", style: { alignItems: "flex-start" } }, h("input", { type: "checkbox", checked: done.has(id), "data-testid": "challenge-" + id, onChange: (e) => { e.target.checked ? done.add(id) : done.delete(id); store.set("api.done", [...done]); upd(); } }), h("span", { text: x }));
    }))));
    upd();
  },
});
