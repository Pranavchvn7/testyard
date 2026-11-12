// Server-level checks: security headers, static-file hardening, trusted-proxy handling and SEO output. No browser needed.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import zlib from "node:zlib";
import { spawn } from "node:child_process";

const P1 = 3800 + Math.floor(Math.random() * 100);
const P2 = P1 + 100;
const procs = [];
const start = (port, env) => new Promise(async (resolve) => {
  procs.push(spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT: String(port), ...env }, stdio: "ignore" }));
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) break; } catch { /* retry */ } await new Promise((r) => setTimeout(r, 100)); }
  resolve();
});
before(async () => {
  await start(P1, { SITE_URL: "https://example.test", TRUST_PROXY_HOPS: "1", GOOGLE_SITE_VERIFICATION: "tok123" });
  await start(P2, {}); // no proxy trust, no SITE_URL
});
after(() => procs.forEach((p) => p.kill()));

const base = `http://localhost:${P1}`;
const raw = (port, path, headers = {}) => new Promise((resolve, reject) => {
  http.get({ host: "localhost", port, path, headers }, (res) => { const c = []; res.on("data", (d) => c.push(d)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(c) })); }).on("error", reject);
});
const text = async (path, opts) => { const r = await fetch(base + path, { redirect: "manual", ...opts }); return { r, body: await r.text() }; };

test("every HTML response carries the security headers", async () => {
  for (const path of ["/", "/practice/inputs", "/practice/does-not-exist", "/css/app.css"]) {
    const { r } = await text(path);
    const csp = r.headers.get("content-security-policy");
    assert.ok(csp, path + " has no CSP");
    assert.match(csp, /script-src 'self'(;|$)/, "scripts must be limited to self, no unsafe-inline");
    assert.match(csp, /object-src 'none'/); assert.match(csp, /frame-ancestors 'none'/); assert.match(csp, /base-uri 'none'/);
    assert.equal(r.headers.get("x-frame-options"), "DENY");
    assert.equal(r.headers.get("x-content-type-options"), "nosniff");
    assert.match(r.headers.get("strict-transport-security"), /max-age=31536000/);
    assert.ok(r.headers.get("referrer-policy"));
    assert.ok(r.headers.get("permissions-policy"));
  }
});

test("API responses are sandboxed and not sniffable", async () => {
  const { r } = await text("/api/health");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.match(r.headers.get("content-security-policy"), /default-src 'none'/);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
});

test("no source, dotfile or traversal leaks", async () => {
  for (const path of ["/%2e%2e/server.js", "/..%2fserver.js", "/.git/config", "/.env", "/js/../../server.js", "/../api/core.js", "/%2e%2e%2f%2e%2e%2fetc/passwd", "/seo.js", "/package.json", "/server.js"]) {
    const r = await raw(P1, path);
    assert.ok([400, 403, 404].includes(r.status), `${path} returned ${r.status}`);
    assert.ok(!/createServer|scrypt|"name": "testyard"/.test(r.body.toString()), `${path} leaked source`);
  }
  assert.equal((await raw(P1, "/%00")).status, 400);
  assert.equal((await raw(P1, "/%E0%A4%A")).status, 400);
});

test("only GET/HEAD are accepted for pages; errors stay generic", async () => {
  assert.equal((await fetch(base + "/", { method: "POST" })).status, 405);
  const r = await fetch(base + "/api/users/%E0%A4%A");
  assert.equal(r.status, 400);
  assert.ok(!/at .*\(|node_modules|\/home\//.test(await r.text()), "no stack traces or paths");
});

test("oversized request bodies are rejected before processing", async () => {
  const r = await fetch(base + "/api/echo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ x: "a".repeat(200 * 1024) }) });
  assert.equal(r.status, 413);
});

test("X-Forwarded-For is only trusted from the configured proxy hop", async () => {
  const trusted = JSON.parse((await raw(P1, "/api/ip", { "x-forwarded-for": "1.1.1.1, 2.2.2.2" })).body).data.ip;
  assert.equal(trusted, "2.2.2.2", "must use the entry appended by our own proxy, not the client-supplied first one");
  const untrusted = JSON.parse((await raw(P2, "/api/ip", { "x-forwarded-for": "1.1.1.1" })).body).data.ip;
  assert.notEqual(untrusted, "1.1.1.1");
});

test("home page HTML is crawlable without JavaScript", async () => {
  const { r, body } = await text("/");
  assert.equal(r.status, 200);
  assert.match(body, /<title>Free QA Practice Website for Test Automation \| TestYard<\/title>/);
  assert.match(body, /<link rel="canonical" href="https:\/\/example\.test\/">/);
  assert.match(body, /<h1>Free QA practice website for <em>test automation<\/em><\/h1>/);
  assert.match(body, /name="google-site-verification" content="tok123"/);
  assert.match(body, /property="og:image" content="https:\/\/example\.test\/og-image\.png"/);
  const links = body.match(/href="\/practice\/[a-z0-9-]+"/g) || [];
  assert.ok(new Set(links).size >= 40, "expected 40+ crawlable page links, got " + new Set(links).size);
  for (const m of body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1]);
  assert.ok(!body.includes("<!--SEO_"), "template markers must be replaced");
});

test("each practice page has its own title, description and canonical URL", async () => {
  const seen = new Set();
  const sm = await (await fetch(base + "/sitemap.xml")).text();
  const urls = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length >= 42);
  for (const u of urls.filter((x) => x.includes("/practice/"))) {
    const { r, body } = await text(new URL(u).pathname);
    assert.equal(r.status, 200, u);
    const title = /<title>(.*?)<\/title>/.exec(body)[1].replace(/&amp;/g, "&");
    assert.ok(!seen.has(title), "duplicate title " + title); seen.add(title);
    assert.ok(title.length <= 75, "title too long: " + title);
    const desc = /name="description" content="(.*?)"/.exec(body)[1];
    assert.ok(desc.length > 50 && desc.length <= 160, `description length ${desc.length} on ${u}`);
    assert.ok(body.includes(`<link rel="canonical" href="${u}">`), "canonical mismatch " + u);
    assert.match(body, /<h1>/);
  }
});

test("sitemap, robots, redirects, 404 and noindex behave", async () => {
  const sm = await text("/sitemap.xml");
  assert.match(sm.r.headers.get("content-type"), /xml/);
  assert.ok(sm.body.includes("<loc>https://example.test/</loc>"));
  assert.ok(!sm.body.includes("window-child"), "hidden helper page must not be in the sitemap");
  const rb = (await text("/robots.txt")).body;
  assert.match(rb, /Sitemap: https:\/\/example\.test\/sitemap\.xml/); assert.match(rb, /Disallow: \/api\//);
  const hidden = await text("/practice/window-child");
  assert.match(hidden.body, /name="robots" content="noindex/);
  const nf = await text("/practice/nope");
  assert.equal(nf.r.status, 404); assert.match(nf.body, /noindex/);
  const slash = await text("/practice/inputs/");
  assert.equal(slash.r.status, 301); assert.equal(slash.r.headers.get("location"), "/practice/inputs");
  assert.equal((await text("/index.html")).r.status, 301);
});

test("text assets are gzip-compressed", async () => {
  const r = await raw(P1, "/js/pages/elements.js", { "accept-encoding": "gzip" });
  assert.equal(r.headers["content-encoding"], "gzip");
  assert.match(zlib.gunzipSync(r.body).toString(), /Text inputs/);
});

test("no secrets or debug code are committed", async () => {
  const { execSync } = await import("node:child_process");
  const out = execSync(`grep -rnE "(sk_live|sk_test|AKIA[0-9A-Z]{16}|BEGIN (RSA |EC )?PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|xox[bp]-)" --include=*.js --include=*.json --include=*.html --include=*.yml --include=*.md --exclude=security.test.js --exclude-dir=node_modules . || true`, { encoding: "utf8" });
  assert.equal(out.trim(), "", "possible secret found:\n" + out);
  const debug = execSync(`grep -rnE "console\\.log|debugger|TODO|FIXME" server.js seo.js api public/js | grep -v "server.listen" | grep -v "pages/learn.js" || true`, { encoding: "utf8" });
  assert.equal(debug.trim(), "", "debug leftovers:\n" + debug);
});
