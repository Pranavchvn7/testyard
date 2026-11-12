// TestYard API core: framework-free request handler.
// handle({ method, url, headers, rawBody, ip }) -> { status, headers, body }
// All state lives in per-"sandbox" memory so learners never collide with each other.
import crypto from "node:crypto";

const TTL_MS = 2 * 60 * 60 * 1000; // sandboxes expire after 2h of inactivity
const MAX_SANDBOXES = 2000;
const PUBLIC_RESET_MS = 30 * 60 * 1000; // the shared default sandbox is wiped every 30 min
const MAX_BODY = 100 * 1024;
const sandboxes = new Map();

export const DEMO_ACCOUNT = { email: "practice@testyard.dev", password: "SecretPass1!" };
const DEMO_SALT = "testyard-demo-salt";
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 32).toString("hex");
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const DEMO_HASH = hashPw(DEMO_ACCOUNT.password, DEMO_SALT);
const DUMMY_HASH = hashPw("not-a-real-password", DEMO_SALT); // keeps login timing equal for unknown emails

// ---------- tiny fixed-window limiter (returns seconds to wait, or 0) ----------
const buckets = new Map();
function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) { b = { start: now, n: 0, windowMs }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 20000) {
    for (const [k, v] of buckets) { if (now - v.start > v.windowMs) buckets.delete(k); if (buckets.size < 15000) break; }
    if (buckets.size > 20000) buckets.delete(buckets.keys().next().value);
  }
  return b.n > limit ? Math.max(1, Math.ceil((windowMs - (now - b.start)) / 1000)) : 0;
}
const blocked = (key, limit) => { const b = buckets.get(key); return b && Date.now() - b.start <= b.windowMs && b.n >= limit ? Math.max(1, Math.ceil((b.windowMs - (Date.now() - b.start)) / 1000)) : 0; };
const tooMany = (wait, msg) => ({ ...fail(429, msg), headers: { "Retry-After": String(wait) } });

// at most 5 concurrent slow requests per IP so /delay can't be used to tie the server up
const inflight = new Map();
async function slow(ip, ms) {
  const n = inflight.get(ip) || 0;
  if (n >= 5) return false;
  inflight.set(ip, n + 1);
  try { await new Promise((r) => setTimeout(r, ms)); } finally { const m = (inflight.get(ip) || 1) - 1; m ? inflight.set(ip, m) : inflight.delete(ip); }
  return true;
}

const PEOPLE = [
  ["Asha Verma", "QA Engineer"], ["Liam Carter", "SDET"], ["Mei Tanaka", "Test Lead"],
  ["Omar Haddad", "Automation Architect"], ["Sofia Rossi", "Performance Tester"],
  ["Ken Adeyemi", "Manual Tester"], ["Priya Nair", "QA Manager"], ["Lucas Meyer", "DevOps Engineer"],
  ["Hana Kim", "Security Tester"], ["Diego Silva", "API Tester"], ["Zoe Martin", "Accessibility Tester"],
  ["Ravi Patel", "Release Manager"],
];

export const PRODUCTS = [
  ["Mechanical Keyboard", "Electronics", 89.99, "⌨️"], ["Wireless Mouse", "Electronics", 24.5, "🖱️"],
  ["USB-C Hub", "Electronics", 39.0, "🔌"], ["Noise-Cancelling Headphones", "Electronics", 199.0, "🎧"],
  ["Webcam 1080p", "Electronics", 59.9, "📷"], ["Portable SSD 1TB", "Electronics", 109.0, "💾"],
  ["Clean Code", "Books", 32.0, "📘"], ["The Pragmatic Programmer", "Books", 41.5, "📗"],
  ["Testing JavaScript", "Books", 29.0, "📙"], ["Working Effectively with Legacy Code", "Books", 45.0, "📕"],
  ["Lessons Learned in Software Testing", "Books", 27.5, "📓"], ["Continuous Delivery", "Books", 49.0, "📔"],
  ["Standing Desk Mat", "Home", 34.0, "🧘"], ["Desk Lamp", "Home", 27.0, "💡"],
  ["Ceramic Coffee Mug", "Home", 12.0, "☕"], ["Indoor Plant", "Home", 18.5, "🪴"],
  ["Bug Hunter Hoodie", "Clothing", 55.0, "🧥"], ["Assert T-Shirt", "Clothing", 22.0, "👕"],
  ["Flaky Test Socks", "Clothing", 9.5, "🧦"], ["Green Build Cap", "Clothing", 16.0, "🧢"],
].map(([name, category, price, emoji], i) => ({
  id: i + 1, name, category, price, emoji,
  rating: Math.round((3.4 + ((i * 37) % 16) / 10) * 10) / 10,
  stock: 3 + ((i * 11) % 40),
}));

function seed() {
  const users = PEOPLE.map(([name, job], i) => ({
    id: i + 1, name, job, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`,
    createdAt: new Date(Date.UTC(2025, i % 12, 3 + i)).toISOString(),
  }));
  return {
    seen: Date.now(), created: Date.now(),
    users, nextUserId: users.length + 1,
    accounts: [{ id: 1, name: "Practice User", email: DEMO_ACCOUNT.email, salt: DEMO_SALT, hash: DEMO_HASH }],
    nextAccountId: 2,
    tokens: new Map(), otps: new Map(),
    notes: [], nextNoteId: 1,
    orders: [], nextOrderId: 1000,
    stock: new Map(PRODUCTS.map((p) => [p.id, p.stock])),
    rl: [],
  };
}

function getBox(rawId, ip) {
  const id = String(rawId || "public").replace(/[^\w-]/g, "").slice(0, 40) || "public";
  const now = Date.now();
  for (const [k, v] of sandboxes) { // Map iterates oldest-first
    if (now - v.seen > TTL_MS) sandboxes.delete(k); else break;
  }
  let box = sandboxes.get(id);
  if (box && id === "public" && now - box.created > PUBLIC_RESET_MS) { sandboxes.delete(id); box = undefined; }
  else if (box) { sandboxes.delete(id); }
  if (!box) {
    if (ip && id !== "public" && hit("mk:" + ip, 30, 60000)) return null; // too many new sandboxes from one IP
    if (sandboxes.size >= MAX_SANDBOXES) sandboxes.delete(sandboxes.keys().next().value);
    box = seed();
  }
  box.seen = now;
  box.id = id;
  sandboxes.set(id, box);
  return box;
}

// ---------- response helpers ----------
const ok = (status, message, data) => ({ status, json: { success: true, status, message, ...(data !== undefined ? { data } : {}) } });
const fail = (status, message, extra = {}) => ({ status, json: { success: false, status, message, ...extra } });
const validation = (errors) => fail(400, "Validation failed", { errors });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const isEmail = (v) => typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v);
const str = (v, max = 100) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const HIDDEN_HEADERS = /^(x-forwarded-.*|x-real-ip|forwarded|via|cf-.*|cdn-loop|rndr-.*|x-render-.*|x-request-start|true-client-ip|fly-.*|x-vercel-.*)$/;
const SECRET_HEADERS = new Set(["authorization", "proxy-authorization", "cookie", "x-auth-token"]);
function visibleHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) { if (!HIDDEN_HEADERS.test(k)) out[k] = SECRET_HEADERS.has(k) ? "[REDACTED]" : v; }
  return out;
}
const publicAccount = (a) => ({ id: a.id, name: a.name, email: a.email });

function bearer(headers) {
  const h = headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : headers["x-auth-token"] || null;
}
function authUser(box, headers) {
  const token = bearer(headers);
  if (!token) return null;
  const t = box.tokens.get(token);
  if (!t || t.exp < Date.now()) { box.tokens.delete(token); return null; }
  return box.accounts.find((a) => a.id === t.accountId) || null;
}
const needAuth = () => fail(401, "Authentication required. Send the header Authorization: Bearer <token>");
const newToken = (box, accountId) => {
  if (box.tokens.size >= 200) box.tokens.delete(box.tokens.keys().next().value);
  const token = crypto.randomBytes(24).toString("hex");
  box.tokens.set(token, { accountId, exp: Date.now() + 60 * 60 * 1000 });
  return token;
};

// ---------- route table (also drives /api/openapi.json) ----------
const routes = [];
function route(method, path, tag, summary, meta, handler) {
  const keys = [];
  const re = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$");
  routes.push({ method, path, re, keys, tag, summary, meta: meta || {}, handler });
}

// --- Health & utilities
route("GET", "/api/health", "Utilities", "Service health check", { codes: [200] }, () => ok(200, "TestYard API is up", { status: "ok" }));

route("POST", "/api/reset", "Utilities", "Reset your sandbox back to seed data", { codes: [200] }, ({ box }) => {
  sandboxes.delete(box.id);
  getBox(box.id);
  return ok(200, "Sandbox reset to seed data");
});

route("GET", "/api/ip", "Utilities", "Your public IP address as seen by the server", { codes: [200] }, ({ ip }) => ok(200, "Your IP", { ip }));
route("GET", "/api/headers", "Utilities", "Echo the request headers (proxy headers hidden, credentials redacted)", { codes: [200] }, ({ headers }) => ok(200, "Request headers", { headers: visibleHeaders(headers) }));

route("GET", "/api/status/:code", "Utilities", "Respond with any HTTP status code (100-599)", { codes: [200, 204, 301, 400, 401, 403, 404, 418, 429, 500, 503] }, ({ params }) => {
  const code = Number(params.code);
  if (!Number.isInteger(code) || code < 200 || code > 599) return fail(400, "code must be an integer between 200 and 599");
  if (code === 204 || code === 304) return { status: code };
  if (code >= 300 && code < 400) return { status: code, headers: { Location: "/api/health" }, json: { success: false, status: code, message: `Status ${code}` } };
  return { status: code, json: { success: code < 400, status: code, message: `Status ${code}` } };
});

route("GET", "/api/delay/:ms", "Utilities", "Respond after a delay (max 10000 ms, 5 concurrent per IP)", { codes: [200, 400, 429] }, async ({ params, ip }) => {
  const ms = Number(params.ms);
  if (!Number.isFinite(ms) || ms < 0) return fail(400, "ms must be a non-negative number");
  const wait = Math.min(ms, 10000);
  if (!(await slow(ip, wait))) return tooMany(2, "Too many concurrent slow requests (max 5 per IP)");
  return ok(200, `Delayed ${wait} ms`, { delayedMs: wait });
});

route("GET", "/api/flaky", "Utilities", "Randomly fails. failRate=0..1 (default 0.5)", { query: [["failRate", "probability of failure, 0-1"]], codes: [200, 503] }, ({ query }) => {
  const rate = Math.min(1, Math.max(0, Number(query.failRate ?? 0.5)));
  return Math.random() < rate ? fail(503, "Flaky failure (try again)") : ok(200, "Flaky success");
});

route("GET", "/api/random", "Utilities", "Random number, uuid and timestamp", { codes: [200] }, () =>
  ok(200, "Random values", { number: Math.floor(Math.random() * 1000), uuid: crypto.randomUUID(), at: new Date().toISOString() }));

route("GET", "/api/redirect/:n", "Utilities", "Redirect n times (max 10) and end at /api/health", { codes: [302] }, ({ params }) => {
  const n = Math.min(10, Math.max(0, parseInt(params.n, 10) || 0));
  return { status: 302, headers: { Location: n <= 1 ? "/api/health" : `/api/redirect/${n - 1}` }, json: { success: true, status: 302, message: `Redirecting, ${n} hop(s) left` } };
});

route("GET", "/api/rate-limit-demo", "Utilities", "Allows 5 calls per 10 s per sandbox, then 429 with Retry-After", { codes: [200, 429] }, ({ box }) => {
  const now = Date.now();
  box.rl = box.rl.filter((t) => now - t < 10000);
  if (box.rl.length >= 5) {
    const retry = Math.ceil((10000 - (now - box.rl[0])) / 1000);
    return { ...fail(429, "Too many requests, slow down"), headers: { "Retry-After": String(retry) } };
  }
  box.rl.push(now);
  return ok(200, `Call ${box.rl.length} of 5 in this window`, { remaining: 5 - box.rl.length });
});

route("ANY", "/api/echo", "Utilities", "Echo method, query, headers and body (any HTTP method)", { body: { hello: "world" }, codes: [200] }, ({ method, query, headers, body }) =>
  ok(200, "Echo", { method, query, headers: visibleHeaders(headers), body: body ?? null }));

route("GET", "/api/auth/basic", "Utilities", "HTTP Basic auth challenge (admin / admin)", { codes: [200, 401] }, ({ headers }) => {
  const m = /^Basic\s+(.+)$/i.exec(headers["authorization"] || "");
  const [u, p] = m ? Buffer.from(m[1], "base64").toString().split(":") : [];
  if (u === "admin" && p === "admin") return ok(200, "Basic auth succeeded", { user: "admin" });
  return { ...fail(401, "Basic auth required (admin / admin)"), headers: { "WWW-Authenticate": 'Basic realm="TestYard"' } };
});

route("GET", "/api/slow-image", "Utilities", "SVG image that loads slowly. ms=0..10000", { query: [["ms", "delay"], ["label", "text"]], codes: [200] }, async ({ query, ip }) => {
  const ms = Math.min(10000, Math.max(0, Number(query.ms) || 2000));
  if (!(await slow(ip, ms))) return tooMany(2, "Too many concurrent slow requests (max 5 per IP)");
  const label = String(query.label || `loaded after ${ms} ms`).replace(/[<>&"]/g, "").slice(0, 40);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140"><rect width="100%" height="100%" fill="#e8481c"/><text x="50%" y="54%" fill="#fff" font-family="monospace" font-size="18" text-anchor="middle">${label}</text></svg>`;
  return { status: 200, headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" }, text: svg };
});

const FILES = {
  "sample.csv": ["text/csv", "id,name,role\n1,Asha,QA\n2,Liam,SDET\n3,Mei,Lead\n"],
  "sample.json": ["application/json", JSON.stringify({ tool: "TestYard", items: [1, 2, 3] }, null, 2)],
  "sample.txt": ["text/plain", "Hello from TestYard.\nThis file exists so you can practise download assertions.\n"],
};
route("GET", "/api/files/:name", "Files", "Download a sample file (sample.csv, sample.json, sample.txt)", { codes: [200, 404] }, ({ params }) => {
  const f = Object.hasOwn(FILES, params.name) ? FILES[params.name] : null;
  if (!f) return fail(404, "File not found. Try sample.csv, sample.json or sample.txt");
  return { status: 200, headers: { "Content-Type": f[0], "Content-Disposition": `attachment; filename="${params.name}"` }, text: f[1] };
});

route("POST", "/api/upload", "Files", "Upload files (multipart/form-data). Max 1 MB each, returns names and sizes", { codes: [201, 400, 415] }, ({ headers, rawBody }) => {
  const ct = headers["content-type"] || "";
  const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
  if (!/multipart\/form-data/i.test(ct) || !bm) return fail(415, "Send multipart/form-data with at least one file field");
  const boundary = "--" + (bm[1] || bm[2]);
  const files = [];
  for (const part of String(rawBody).split(boundary)) {
    const split = part.indexOf("\r\n\r\n");
    if (split < 0) continue;
    const head = part.slice(0, split);
    const fm = /filename="([^"]*)"/i.exec(head);
    if (!fm || !fm[1]) continue;
    const tm = /content-type:\s*([^\r\n]+)/i.exec(head);
    files.push({ field: (/name="([^"]*)"/i.exec(head) || [])[1], filename: fm[1], contentType: tm ? tm[1] : "application/octet-stream", size: Math.max(0, part.length - split - 4 - 2) });
  }
  if (!files.length) return fail(400, "No file found in the request");
  if (files.some((f) => f.size > 1024 * 1024)) return fail(400, "File too large (max 1 MB)");
  return ok(201, `${files.length} file(s) uploaded (not stored)`, { files });
});

// --- Auth
route("POST", "/api/auth/register", "Auth", "Register a new account", { body: { name: "Jane Tester", email: "jane@example.test", password: "Passw0rd!" }, codes: [201, 400, 409] }, ({ body, box, ip }) => {
  const b = isObj(body) ? body : {};
  const errors = [];
  if (typeof b.name !== "string" || b.name.trim().length < 3 || b.name.length > 100) errors.push({ field: "name", message: "name must be 3-100 characters" });
  if (!isEmail(b.email)) errors.push({ field: "email", message: "email must be a valid address" });
  if (typeof b.password !== "string" || b.password.length < 6 || b.password.length > 30) errors.push({ field: "password", message: "password must be 6-30 characters" });
  if (errors.length) return validation(errors);
  const slowWait = hit("auth:" + ip, 60, 60000);
  if (slowWait) return tooMany(slowWait, "Too many sign-up/login attempts from this IP, slow down");
  if (box.accounts.length >= 50) return fail(400, "Account limit reached (50). POST /api/reset to start over");
  if (box.accounts.some((a) => a.email.toLowerCase() === b.email.toLowerCase())) return fail(409, "An account with this email already exists");
  const salt = crypto.randomBytes(8).toString("hex");
  const acc = { id: box.nextAccountId++, name: b.name.trim(), email: b.email, salt, hash: hashPw(b.password, salt) };
  box.accounts.push(acc);
  return ok(201, "Account created. You can now log in.", publicAccount(acc));
});

route("POST", "/api/auth/login", "Auth", `Log in. Demo account: ${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`, { body: { ...DEMO_ACCOUNT }, codes: [200, 400, 401] }, ({ body, box, ip }) => {
  const b = isObj(body) ? body : {};
  if (!b.email || !b.password) return validation([{ field: !b.email ? "email" : "password", message: "required" }]);
  if (typeof b.email !== "string" || typeof b.password !== "string" || b.email.length > 254 || b.password.length > 128) return validation([{ field: "email/password", message: "must be strings of a reasonable length" }]);
  const ipWait = hit("auth:" + ip, 60, 60000);
  if (ipWait) return tooMany(ipWait, "Too many sign-up/login attempts from this IP, slow down");
  const failKey = `loginfail:${box.id}:${b.email.toLowerCase()}`;
  const lock = blocked(failKey, 10);
  if (lock) return tooMany(lock, "Too many failed logins for this account, try again later");
  const acc = box.accounts.find((a) => a.email.toLowerCase() === b.email.toLowerCase());
  const good = safeEq(hashPw(b.password, acc ? acc.salt : DEMO_SALT), acc ? acc.hash : DUMMY_HASH) && acc;
  if (!good) { hit(failKey, 10, 60000); return fail(401, "Incorrect email address or password"); }
  buckets.delete(failKey);
  return ok(200, "Login successful", { ...publicAccount(acc), token: newToken(box, acc.id), expiresInSeconds: 3600 });
});

route("GET", "/api/auth/profile", "Auth", "Get the logged-in profile", { auth: true, codes: [200, 401] }, ({ box, headers }) => {
  const a = authUser(box, headers);
  return a ? ok(200, "Profile", publicAccount(a)) : needAuth();
});
route("PATCH", "/api/auth/profile", "Auth", "Update your display name", { auth: true, body: { name: "New Name" }, codes: [200, 400, 401] }, ({ box, headers, body }) => {
  const a = authUser(box, headers);
  if (!a) return needAuth();
  if (!isObj(body) || typeof body.name !== "string" || body.name.trim().length < 3) return validation([{ field: "name", message: "name must be at least 3 characters" }]);
  a.name = body.name.trim();
  return ok(200, "Profile updated", publicAccount(a));
});
route("DELETE", "/api/auth/profile", "Auth", "Delete your account and all of its notes", { auth: true, codes: [200, 401] }, ({ box, headers }) => {
  const a = authUser(box, headers);
  if (!a) return needAuth();
  box.accounts = box.accounts.filter((x) => x.id !== a.id);
  box.notes = box.notes.filter((n) => n.ownerId !== a.id);
  for (const [t, v] of box.tokens) if (v.accountId === a.id) box.tokens.delete(t);
  box.otps.delete(a.email.toLowerCase());
  return ok(200, "Account and all associated data deleted");
});
route("POST", "/api/auth/logout", "Auth", "Invalidate the current token", { auth: true, codes: [200, 401] }, ({ box, headers }) => {
  if (!authUser(box, headers)) return needAuth();
  box.tokens.delete(bearer(headers));
  return ok(200, "Logged out");
});
route("POST", "/api/auth/forgot", "Auth", "Request a password reset (always answers 200, 20 per hour per sandbox)", { body: { email: DEMO_ACCOUNT.email }, codes: [200, 400, 429] }, ({ body, box }) => {
  const fw = hit(`forgot:${box.id}`, 20, 3600000);
  if (fw) return tooMany(fw, "Too many reset requests, try again later");
  if (!isObj(body) || !isEmail(body.email)) return validation([{ field: "email", message: "email must be a valid address" }]);
  return ok(200, "If that email exists, a reset link has been sent");
});
route("POST", "/api/auth/otp/request", "Auth", "Request a one-time password (returned in the response for practice)", { body: { email: DEMO_ACCOUNT.email }, codes: [200, 400, 404] }, ({ body, box }) => {
  if (!isObj(body) || !isEmail(body.email)) return validation([{ field: "email", message: "email must be a valid address" }]);
  const otpWait = hit(`otp:${box.id}`, 10, 60000);
  if (otpWait) return tooMany(otpWait, "Too many OTP requests, try again shortly");
  const acc = box.accounts.find((a) => a.email.toLowerCase() === body.email.toLowerCase());
  if (!acc) return fail(404, "No account with this email");
  const otp = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  box.otps.set(acc.email.toLowerCase(), { otp, exp: Date.now() + 120000, tries: 0 });
  return ok(200, "OTP generated. It expires in 2 minutes, 3 attempts allowed.", { otp });
});
route("POST", "/api/auth/otp/verify", "Auth", "Verify a one-time password and receive a token", { body: { email: DEMO_ACCOUNT.email, otp: "123456" }, codes: [200, 400, 401, 429] }, ({ body, box }) => {
  if (!isObj(body) || !body.email || !body.otp) return validation([{ field: !body?.email ? "email" : "otp", message: "required" }]);
  const key = String(body.email).toLowerCase();
  const rec = box.otps.get(key);
  if (!rec || rec.exp < Date.now()) return fail(401, "OTP expired or not requested");
  if (rec.tries >= 3) return fail(429, "Too many attempts. Request a new OTP");
  rec.tries++;
  if (String(body.otp) !== rec.otp) return fail(401, `Wrong OTP (${3 - rec.tries} attempt(s) left)`);
  box.otps.delete(key);
  const acc = box.accounts.find((a) => a.email.toLowerCase() === key);
  return ok(200, "OTP verified", { ...publicAccount(acc), token: newToken(box, acc.id) });
});

// --- Notes (authenticated CRUD)
const CATEGORIES = ["Home", "Work", "Personal"];
function validateNote(b, partial) {
  const errors = [];
  if (!partial || b.title !== undefined) if (typeof b.title !== "string" || b.title.trim().length < 4 || b.title.length > 100) errors.push({ field: "title", message: "title must be 4-100 characters" });
  if (!partial || b.description !== undefined) if (typeof b.description !== "string" || b.description.length > 1000) errors.push({ field: "description", message: "description must be a string up to 1000 characters" });
  if (!partial || b.category !== undefined) if (!CATEGORIES.includes(b.category)) errors.push({ field: "category", message: `category must be one of ${CATEGORIES.join(", ")}` });
  if (b.completed !== undefined && typeof b.completed !== "boolean") errors.push({ field: "completed", message: "completed must be true or false" });
  return errors;
}
const mine = (box, acc) => box.notes.filter((n) => n.ownerId === acc.id);
const noteOut = ({ ownerId, ...n }) => n;

route("GET", "/api/notes", "Notes", "List your notes. Filter with category and completed", { auth: true, query: [["category", "Home | Work | Personal"], ["completed", "true | false"]], codes: [200, 401] }, ({ box, headers, query }) => {
  const a = authUser(box, headers);
  if (!a) return needAuth();
  let list = mine(box, a);
  if (query.category) list = list.filter((n) => n.category === query.category);
  if (query.completed) list = list.filter((n) => String(n.completed) === query.completed);
  return ok(200, "Notes", list.map(noteOut));
});
route("POST", "/api/notes", "Notes", "Create a note", { auth: true, body: { title: "Write tests", description: "Cover the login flow", category: "Work" }, codes: [201, 400, 401] }, ({ box, headers, body }) => {
  const a = authUser(box, headers);
  if (!a) return needAuth();
  const b = isObj(body) ? body : {};
  const errors = validateNote(b, false);
  if (errors.length) return validation(errors);
  if (mine(box, a).length >= 100) return fail(400, "Note limit reached (100)");
  const now = new Date().toISOString();
  const note = { id: box.nextNoteId++, ownerId: a.id, title: b.title.trim(), description: b.description, category: b.category, completed: !!b.completed, createdAt: now, updatedAt: now };
  box.notes.push(note);
  return ok(201, "Note created", noteOut(note));
});
const findNote = (box, headers, id) => {
  const a = authUser(box, headers);
  if (!a) return { res: needAuth() };
  const n = mine(box, a).find((x) => x.id === Number(id));
  return n ? { n } : { res: fail(404, "Note not found") };
};
route("GET", "/api/notes/:id", "Notes", "Get one note", { auth: true, codes: [200, 401, 404] }, ({ box, headers, params }) => {
  const { n, res } = findNote(box, headers, params.id);
  return res || ok(200, "Note", noteOut(n));
});
route("PUT", "/api/notes/:id", "Notes", "Replace a note (all fields required)", { auth: true, body: { title: "Updated title", description: "New text", category: "Home", completed: true }, codes: [200, 400, 401, 404] }, ({ box, headers, params, body }) => {
  const { n, res } = findNote(box, headers, params.id);
  if (res) return res;
  const b = isObj(body) ? body : {};
  const errors = validateNote(b, false);
  if (errors.length) return validation(errors);
  Object.assign(n, { title: b.title.trim(), description: b.description, category: b.category, completed: !!b.completed, updatedAt: new Date().toISOString() });
  return ok(200, "Note updated", noteOut(n));
});
route("PATCH", "/api/notes/:id", "Notes", "Partially update a note", { auth: true, body: { completed: true }, codes: [200, 400, 401, 404] }, ({ box, headers, params, body }) => {
  const { n, res } = findNote(box, headers, params.id);
  if (res) return res;
  const b = isObj(body) ? body : {};
  const errors = validateNote(b, true);
  if (errors.length) return validation(errors);
  for (const k of ["title", "description", "category", "completed"]) if (b[k] !== undefined) n[k] = k === "title" ? b[k].trim() : b[k];
  n.updatedAt = new Date().toISOString();
  return ok(200, "Note updated", noteOut(n));
});
route("DELETE", "/api/notes/:id", "Notes", "Delete a note", { auth: true, codes: [200, 401, 404] }, ({ box, headers, params }) => {
  const { n, res } = findNote(box, headers, params.id);
  if (res) return res;
  box.notes.splice(box.notes.indexOf(n), 1);
  return ok(200, "Note deleted");
});

// --- Users (open CRUD sandbox, no auth)
const pageOf = (list, query) => {
  const per = Math.min(50, Math.max(1, parseInt(query.per_page, 10) || 5));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return { page, per_page: per, total: list.length, total_pages: Math.max(1, Math.ceil(list.length / per)), data: list.slice((page - 1) * per, page * per) };
};
route("GET", "/api/users", "Users", "List users (paginated). q searches name/job", { query: [["page", "page number"], ["per_page", "1-50, default 5"], ["q", "search text"]], codes: [200] }, ({ box, query }) => {
  const q = String(query.q || "").toLowerCase();
  const list = q ? box.users.filter((u) => (u.name + " " + u.job).toLowerCase().includes(q)) : box.users;
  return { status: 200, json: { success: true, status: 200, message: "Users", ...pageOf(list, query) } };
});
route("GET", "/api/users/:id", "Users", "Get one user", { codes: [200, 404] }, ({ box, params }) => {
  const u = box.users.find((x) => x.id === Number(params.id));
  return u ? ok(200, "User", u) : fail(404, "User not found");
});
route("POST", "/api/users", "Users", "Create a user (name and job required)", { body: { name: "Nina QA", job: "SDET", email: "nina@example.test" }, codes: [201, 400] }, ({ box, body }) => {
  const b = isObj(body) ? body : {};
  const errors = [];
  if (!str(b.name)) errors.push({ field: "name", message: "name is required (max 100 characters)" });
  if (!str(b.job)) errors.push({ field: "job", message: "job is required (max 100 characters)" });
  if (b.email !== undefined && !isEmail(b.email)) errors.push({ field: "email", message: "email must be valid" });
  if (errors.length) return validation(errors);
  if (box.users.length >= 200) return fail(400, "User limit reached (200). POST /api/reset to start over");
  const u = { id: box.nextUserId++, name: b.name.trim(), job: b.job.trim(), email: b.email || null, createdAt: new Date().toISOString() };
  box.users.push(u);
  return ok(201, "User created", u);
});
route("PUT", "/api/users/:id", "Users", "Replace a user", { body: { name: "Nina QA", job: "Lead", email: "nina@example.test" }, codes: [200, 400, 404] }, ({ box, params, body }) => {
  const u = box.users.find((x) => x.id === Number(params.id));
  if (!u) return fail(404, "User not found");
  const b = isObj(body) ? body : {};
  if (!str(b.name) || !str(b.job)) return validation([{ field: "name/job", message: "name and job are required" }]);
  Object.assign(u, { name: b.name.trim(), job: b.job.trim(), email: b.email ?? null, updatedAt: new Date().toISOString() });
  return ok(200, "User replaced", u);
});
route("PATCH", "/api/users/:id", "Users", "Partially update a user", { body: { job: "Architect" }, codes: [200, 400, 404] }, ({ box, params, body }) => {
  const u = box.users.find((x) => x.id === Number(params.id));
  if (!u) return fail(404, "User not found");
  const b = isObj(body) ? body : {};
  for (const k of ["name", "job", "email"]) if (b[k] !== undefined) { if (!str(b[k], k === "email" ? 254 : 100)) return validation([{ field: k, message: `${k} must be a non-empty string` }]); u[k] = b[k].trim(); }
  u.updatedAt = new Date().toISOString();
  return ok(200, "User updated", u);
});
route("DELETE", "/api/users/:id", "Users", "Delete a user (204, no body)", { codes: [204, 404] }, ({ box, params }) => {
  const i = box.users.findIndex((x) => x.id === Number(params.id));
  if (i < 0) return fail(404, "User not found");
  box.users.splice(i, 1);
  return { status: 204 };
});

// --- Products & orders (shop backend)
route("GET", "/api/products", "Shop", "List products. search, category, sort (price|-price|name|rating), page, limit", { query: [["search", "text"], ["category", "Electronics | Books | Home | Clothing"], ["sort", "price | -price | name | rating"], ["page", ""], ["limit", "1-50, default 12"]], codes: [200] }, ({ box, query }) => {
  let list = PRODUCTS.map((p) => ({ ...p, stock: box.stock.get(p.id) }));
  if (query.search) list = list.filter((p) => p.name.toLowerCase().includes(String(query.search).toLowerCase()));
  if (query.category) list = list.filter((p) => p.category === query.category);
  const sorts = { price: (a, b) => a.price - b.price, "-price": (a, b) => b.price - a.price, name: (a, b) => a.name.localeCompare(b.name), rating: (a, b) => b.rating - a.rating };
  if (typeof query.sort === "string" && Object.hasOwn(sorts, query.sort)) list.sort(sorts[query.sort]);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  return { status: 200, json: { success: true, status: 200, message: "Products", page, limit, total: list.length, total_pages: Math.max(1, Math.ceil(list.length / limit)), data: list.slice((page - 1) * limit, page * limit) } };
});
route("GET", "/api/products/:id", "Shop", "Get one product", { codes: [200, 404] }, ({ box, params }) => {
  const p = PRODUCTS.find((x) => x.id === Number(params.id));
  return p ? ok(200, "Product", { ...p, stock: box.stock.get(p.id) }) : fail(404, "Product not found");
});
route("POST", "/api/orders", "Shop", "Place an order", { body: { items: [{ productId: 1, qty: 2 }], customer: { name: "Jane Tester", email: "jane@example.test", address: "1 Test Street" } }, codes: [201, 400, 409] }, ({ box, body }) => {
  const b = isObj(body) ? body : {};
  const errors = [];
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 20) errors.push({ field: "items", message: "items must be an array of 1-20 lines" });
  const c = isObj(b.customer) ? b.customer : {};
  if (typeof c.name !== "string" || c.name.trim().length < 2 || c.name.length > 100) errors.push({ field: "customer.name", message: "name is required" });
  if (!isEmail(c.email)) errors.push({ field: "customer.email", message: "valid email is required" });
  if (typeof c.address !== "string" || c.address.trim().length < 5 || c.address.length > 300) errors.push({ field: "customer.address", message: "address must be at least 5 characters" });
  if (errors.length) return validation(errors);
  if (box.orders.length >= 100) return fail(400, "Order limit reached (100). POST /api/reset to start over");
  const lines = [];
  const wanted = new Map(); // units per product across ALL lines, so duplicate lines can't dodge the stock check
  for (const it of b.items) {
    const p = PRODUCTS.find((x) => x.id === Number(it?.productId));
    const qty = Number(it?.qty);
    if (!p) return fail(400, `Unknown productId ${String(it?.productId).slice(0, 20)}`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) return fail(400, "qty must be an integer from 1 to 10");
    const units = (wanted.get(p.id) || 0) + qty;
    if (units > 10) return fail(400, "At most 10 units of one product per order");
    if (box.stock.get(p.id) < units) return fail(409, `Not enough stock for ${p.name}`);
    wanted.set(p.id, units);
    lines.push({ productId: p.id, name: p.name, qty, unitPrice: p.price, lineTotal: Math.round(p.price * qty * 100) / 100 });
  }
  for (const l of lines) box.stock.set(l.productId, box.stock.get(l.productId) - l.qty);
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;
  const shipping = subtotal >= 75 ? 0 : 5.99;
  const order = { id: box.nextOrderId++, status: "confirmed", items: lines, subtotal, shipping, total: Math.round((subtotal + shipping) * 100) / 100, customer: { name: c.name, email: c.email, address: c.address }, createdAt: new Date().toISOString() };
  box.orders.push(order);
  return ok(201, "Order placed", order);
});
route("GET", "/api/orders/:id", "Shop", "Get an order", { codes: [200, 404] }, ({ box, params }) => {
  const o = box.orders.find((x) => x.id === Number(params.id));
  return o ? ok(200, "Order", o) : fail(404, "Order not found");
});

// ---------- OpenAPI ----------
export function openapi(baseUrl = "") {
  const paths = {};
  for (const r of routes) {
    const p = r.path.replace(/:(\w+)/g, "{$1}");
    const methods = r.method === "ANY" ? ["get", "post", "put", "patch", "delete"] : [r.method.toLowerCase()];
    for (const m of methods) {
      (paths[p] ||= {})[m] = {
        tags: [r.tag], summary: r.summary,
        parameters: [
          ...r.keys.map((k) => ({ name: k, in: "path", required: true, schema: { type: "string" } })),
          ...(r.meta.query || []).map(([name, description]) => ({ name, in: "query", description, schema: { type: "string" } })),
        ],
        ...(r.meta.body && m !== "get" ? { requestBody: { content: { "application/json": { schema: { type: "object" }, example: r.meta.body } } } } : {}),
        ...(r.meta.auth ? { security: [{ bearerAuth: [] }] } : {}),
        responses: Object.fromEntries((r.meta.codes || [200]).map((c) => [String(c), { description: `HTTP ${c}` }])),
      };
    }
  }
  return {
    openapi: "3.0.3",
    info: { title: "TestYard Practice API", version: "1.0.0", description: "Sandboxed REST API for automation practice. Send header X-Sandbox: <any-id> to get your own isolated data set." },
    servers: [{ url: baseUrl || "/" }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    paths,
  };
}
route("GET", "/api/openapi.json", "Utilities", "OpenAPI 3 document (import into Postman / Swagger UI)", { codes: [200] }, ({ headers }) => ({ status: 200, json: openapi(headers["x-forwarded-proto"] && headers.host ? `${headers["x-forwarded-proto"]}://${headers.host}` : "") }));

// ---------- dispatcher ----------
// CORS_ORIGIN="https://a.example,https://b.example" restricts browsers to those origins. Default "*" because this API is public
// and uses bearer tokens (no cookies), so a wildcard cannot expose anyone's session.
const CORS_LIST = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== "*" ? process.env.CORS_ORIGIN.split(",").map((x) => x.trim()).filter(Boolean) : null;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Auth-Token,X-Sandbox",
  "Access-Control-Expose-Headers": "Retry-After,Location,X-Response-Time,X-Sandbox,Content-Disposition",
  "Access-Control-Max-Age": "600",
};
const API_SEC = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Referrer-Policy": "no-referrer",
};
const ipLimited = (ip) => hit("ip:" + ip, 600, 60000);
function parseBody(raw, contentType) {
  if (!raw) return { value: undefined };
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("application/x-www-form-urlencoded")) return { value: Object.fromEntries(new URLSearchParams(raw)) };
  if (ct.includes("json") || /^\s*[\[{]/.test(raw)) {
    try { return { value: JSON.parse(raw) }; } catch { return { error: "Request body is not valid JSON" }; }
  }
  return { value: raw };
}

export async function handle({ method, url, headers = {}, rawBody = "", ip = "unknown" }) {
  const t0 = Date.now();
  method = String(method).toUpperCase();
  let u;
  try { u = new URL(url, "http://localhost"); } catch { u = null; }
  const lower = Object.create(null);
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;

  const finish = (r, box) => {
    const cors = { ...CORS };
    if (CORS_LIST) { cors["Access-Control-Allow-Origin"] = CORS_LIST.includes(lower.origin) ? lower.origin : CORS_LIST[0]; cors.Vary = "Origin"; }
    const h = { ...API_SEC, ...cors, "X-Response-Time": `${Date.now() - t0}ms`, "Cache-Control": "no-store", ...(box ? { "X-Sandbox": box.id } : {}), ...(r.headers || {}) };
    if (r.status === 204 || r.status === 304) return { status: r.status, headers: h, body: "" };
    if (r.json !== undefined) return { status: r.status, headers: { "Content-Type": "application/json; charset=utf-8", ...h }, body: JSON.stringify(r.json, null, 2) };
    return { status: r.status, headers: h, body: r.text ?? "" };
  };

  if (!u) return finish(fail(400, "Malformed URL"));
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") : u.pathname;
  const query = Object.fromEntries(u.searchParams);
  if (method === "OPTIONS") return finish({ status: 204 });
  const wait = ipLimited(ip);
  if (wait) return finish({ ...fail(429, "Rate limit exceeded (600 requests/minute per IP)"), headers: { "Retry-After": String(wait) } });

  const candidates = routes.filter((r) => r.re.test(path));
  if (!candidates.length) return finish(fail(404, `No API route for ${method} ${path}. See /api/openapi.json`));
  const r = candidates.find((c) => c.method === method || c.method === "ANY");
  if (!r) return finish({ ...fail(405, `Method ${method} not allowed on ${path}`), headers: { Allow: candidates.map((c) => c.method).join(", ") } });

  const isUpload = path === "/api/upload";
  if (rawBody.length > (isUpload ? 4 * 1024 * 1024 : MAX_BODY)) return finish(fail(413, "Request body too large"));
  const parsed = isUpload ? { value: undefined } : parseBody(rawBody, lower["content-type"]);
  if (parsed.error) return finish(fail(400, parsed.error));

  const box = getBox(lower["x-sandbox"] || query.sandbox, ip);
  if (!box) return finish({ ...fail(429, "Too many new sandboxes from this IP, reuse your X-Sandbox id"), headers: { "Retry-After": "30" } });
  const m = r.re.exec(path);
  let params;
  try { params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])); } catch { return finish(fail(400, "Malformed URL encoding"), box); }
  try {
    const res = await r.handler({ method, params, query, body: parsed.value, headers: lower, rawBody, box, ip });
    return finish(res, box);
  } catch (err) {
    const errorId = crypto.randomBytes(4).toString("hex"); // correlation id: shown to the client, details stay in the server log
    console.error("handler error", errorId, err);
    return finish(fail(500, "Internal server error", { errorId }), box);
  }
}

export const routeCount = () => routes.length;
