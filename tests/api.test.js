import test from "node:test";
import assert from "node:assert/strict";
import { handle, DEMO_ACCOUNT, openapi } from "../api/core.js";

let n = 0;
const call = async (method, url, body, headers = {}, sandbox) => {
  const r = await handle({
    method, url, ip: "t" + (n++ % 50),
    headers: { "x-sandbox": sandbox || "test", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    rawBody: body === undefined ? "" : JSON.stringify(body),
  });
  let json; try { json = JSON.parse(r.body); } catch { json = undefined; }
  return { ...r, json };
};

test("health", async () => {
  const r = await call("GET", "/api/health");
  assert.equal(r.status, 200);
  assert.equal(r.json.success, true);
});

test("unknown route -> 404 JSON, wrong method -> 405 with Allow", async () => {
  assert.equal((await call("GET", "/api/nope")).status, 404);
  const r = await call("PUT", "/api/health");
  assert.equal(r.status, 405);
  assert.match(r.headers.Allow, /GET/);
});

test("status endpoint", async () => {
  assert.equal((await call("GET", "/api/status/418")).status, 418);
  assert.equal((await call("GET", "/api/status/204")).body, "");
  assert.equal((await call("GET", "/api/status/99")).status, 400);
});

test("auth: register, duplicate, login, profile, logout", async () => {
  const sb = "auth-" + Date.now();
  const bad = await call("POST", "/api/auth/register", { name: "ab", email: "x", password: "1" }, {}, sb);
  assert.equal(bad.status, 400);
  assert.equal(bad.json.errors.length, 3);
  const reg = await call("POST", "/api/auth/register", { name: "Jane Tester", email: "jane@example.test", password: "Passw0rd!" }, {}, sb);
  assert.equal(reg.status, 201);
  assert.equal((await call("POST", "/api/auth/register", { name: "Jane Tester", email: "JANE@example.test", password: "Passw0rd!" }, {}, sb)).status, 409);
  assert.equal((await call("POST", "/api/auth/login", { email: "jane@example.test", password: "wrong" }, {}, sb)).status, 401);
  const login = await call("POST", "/api/auth/login", { email: "jane@example.test", password: "Passw0rd!" }, {}, sb);
  assert.equal(login.status, 200);
  const auth = { authorization: `Bearer ${login.json.data.token}` };
  assert.equal((await call("GET", "/api/auth/profile", undefined, auth, sb)).json.data.email, "jane@example.test");
  assert.equal((await call("POST", "/api/auth/logout", undefined, auth, sb)).status, 200);
  assert.equal((await call("GET", "/api/auth/profile", undefined, auth, sb)).status, 401);
});

test("notes CRUD is scoped to the user", async () => {
  const sb = "notes-" + Date.now();
  const login = await call("POST", "/api/auth/login", DEMO_ACCOUNT, {}, sb);
  const auth = { authorization: `Bearer ${login.json.data.token}` };
  assert.equal((await call("GET", "/api/notes", undefined, {}, sb)).status, 401);
  assert.equal((await call("POST", "/api/notes", { title: "x" }, auth, sb)).status, 400);
  const c = await call("POST", "/api/notes", { title: "Write tests", description: "d", category: "Work" }, auth, sb);
  assert.equal(c.status, 201);
  const id = c.json.data.id;
  assert.equal((await call("PATCH", `/api/notes/${id}`, { completed: true }, auth, sb)).json.data.completed, true);
  assert.equal((await call("GET", "/api/notes?completed=true", undefined, auth, sb)).json.data.length, 1);
  assert.equal((await call("DELETE", `/api/notes/${id}`, undefined, auth, sb)).status, 200);
  assert.equal((await call("GET", `/api/notes/${id}`, undefined, auth, sb)).status, 404);
});

test("users CRUD + pagination + sandbox isolation", async () => {
  const a = "u-a-" + Date.now(), b = "u-b-" + Date.now();
  const list = await call("GET", "/api/users?per_page=5&page=2", undefined, {}, a);
  assert.equal(list.json.page, 2);
  assert.equal(list.json.data.length, 5);
  const c = await call("POST", "/api/users", { name: "Nina", job: "SDET" }, {}, a);
  assert.equal(c.status, 201);
  assert.equal((await call("GET", `/api/users/${c.json.data.id}`, undefined, {}, b)).status, 404);
  assert.equal((await call("DELETE", `/api/users/${c.json.data.id}`, undefined, {}, a)).status, 204);
  assert.equal((await call("POST", "/api/users", { name: "x" }, {}, a)).status, 400);
});

test("invalid JSON -> 400", async () => {
  const r = await handle({ method: "POST", url: "/api/users", ip: "j", headers: { "content-type": "application/json" }, rawBody: "{bad" });
  assert.equal(r.status, 400);
});

test("orders validate stock and totals", async () => {
  const sb = "o-" + Date.now();
  const customer = { name: "Jane", email: "j@example.test", address: "1 Test Street" };
  const o = await call("POST", "/api/orders", { items: [{ productId: 1, qty: 1 }], customer }, {}, sb);
  assert.equal(o.status, 201);
  assert.equal(o.json.data.shipping, 0); // 89.99 >= 75 free shipping
  assert.equal((await call("POST", "/api/orders", { items: [{ productId: 999, qty: 1 }], customer }, {}, sb)).status, 400);
});

test("rate-limit demo returns 429 after 5 calls", async () => {
  const sb = "rl-" + Date.now();
  let last;
  for (let i = 0; i < 6; i++) last = await call("GET", "/api/rate-limit-demo", undefined, {}, sb);
  assert.equal(last.status, 429);
  assert.ok(last.headers["Retry-After"]);
});

test("OTP flow", async () => {
  const sb = "otp-" + Date.now();
  const req = await call("POST", "/api/auth/otp/request", { email: DEMO_ACCOUNT.email }, {}, sb);
  const otp = req.json.data.otp;
  assert.equal((await call("POST", "/api/auth/otp/verify", { email: DEMO_ACCOUNT.email, otp: otp === "000000" ? "111111" : "000000" }, {}, sb)).status, 401);
  assert.equal((await call("POST", "/api/auth/otp/verify", { email: DEMO_ACCOUNT.email, otp }, {}, sb)).status, 200);
});

test("openapi lists routes", () => {
  const doc = openapi();
  assert.ok(Object.keys(doc.paths).length > 20);
  assert.ok(doc.paths["/api/notes/{id}"].delete);
});

// ---------------------------------------------------------------- security hardening
test("health check leaks nothing about the host", async () => {
  const r = await call("GET", "/api/health");
  assert.deepEqual(r.json.data, { status: "ok" });
});

test("order lines cannot dodge the stock check by repeating a product", async () => {
  const sb = "stock-" + Date.now();
  const customer = { name: "Eve", email: "e@example.test", address: "1 Test Street" };
  const before = (await call("GET", "/api/products/1", undefined, {}, sb)).json.data.stock; // 3 in stock
  const dup = await call("POST", "/api/orders", { items: [{ productId: 1, qty: before }, { productId: 1, qty: before }], customer }, {}, sb);
  assert.equal(dup.status, 409);
  assert.equal((await call("GET", "/api/products/1", undefined, {}, sb)).json.data.stock, before);
  assert.equal((await call("POST", "/api/orders", { items: [{ productId: 1, qty: -1 }], customer }, {}, sb)).status, 400);
  assert.equal((await call("POST", "/api/orders", { items: Array.from({ length: 21 }, () => ({ productId: 2, qty: 1 })), customer }, {}, sb)).status, 400);
});

test("malformed URLs and prototype keys never cause a 500", async () => {
  assert.equal((await call("GET", "/api/users/%E0%A4%A")).status, 400);
  assert.equal((await call("GET", "/api/files/__proto__")).status, 404);
  assert.equal((await call("GET", "/api/files/constructor")).status, 404);
  assert.equal((await call("GET", "/api/products?sort=__proto__")).status, 200);
  assert.equal((await call("GET", "/api/users?q=__proto__")).status, 200);
});

test("login locks an account after 10 failures and says when to retry", async () => {
  const sb = "lock-" + Date.now();
  for (let i = 0; i < 10; i++) assert.equal((await call("POST", "/api/auth/login", { email: DEMO_ACCOUNT.email, password: "bad" + i }, {}, sb)).status, 401);
  const locked = await call("POST", "/api/auth/login", DEMO_ACCOUNT, {}, sb); // even the right password is refused while locked
  assert.equal(locked.status, 429);
  assert.ok(Number(locked.headers["Retry-After"]) > 0);
  // a different sandbox is unaffected
  assert.equal((await call("POST", "/api/auth/login", DEMO_ACCOUNT, {}, "lock-other-" + Date.now())).status, 200);
});

test("credentials and proxy headers are never echoed back", async () => {
  const r = await call("GET", "/api/headers", undefined, { authorization: "Bearer supersecret", cookie: "sid=1", "x-forwarded-for": "9.9.9.9", "x-practice": "hello" });
  const h = r.json.data.headers;
  assert.equal(h.authorization, "[REDACTED]");
  assert.equal(h.cookie, "[REDACTED]");
  assert.equal(h["x-forwarded-for"], undefined);
  assert.equal(h["x-practice"], "hello");
  assert.ok(!r.body.includes("supersecret"));
});

test("users can delete their account and all data", async () => {
  const sb = "del-" + Date.now();
  await call("POST", "/api/auth/register", { name: "Del Me", email: "del@example.test", password: "Passw0rd!" }, {}, sb);
  const login = await call("POST", "/api/auth/login", { email: "del@example.test", password: "Passw0rd!" }, {}, sb);
  const auth = { authorization: `Bearer ${login.json.data.token}` };
  await call("POST", "/api/notes", { title: "Private note", description: "x", category: "Home" }, auth, sb);
  assert.equal((await call("DELETE", "/api/auth/profile", undefined, auth, sb)).status, 200);
  assert.equal((await call("GET", "/api/auth/profile", undefined, auth, sb)).status, 401);
  assert.equal((await call("POST", "/api/auth/login", { email: "del@example.test", password: "Passw0rd!" }, {}, sb)).status, 401);
});

test("input length caps and password never returned", async () => {
  const long = "x".repeat(101);
  assert.equal((await call("POST", "/api/users", { name: long, job: "SDET" })).status, 400);
  assert.equal((await call("POST", "/api/auth/register", { name: long, email: "a@example.test", password: "Passw0rd!" }, {}, "cap-" + Date.now())).status, 400);
  assert.equal((await call("POST", "/api/auth/register", { name: "Ok Name", email: "a".repeat(250) + "@example.test", password: "Passw0rd!" }, {}, "cap2-" + Date.now())).status, 400);
  const sb = "pw-" + Date.now();
  const reg = await call("POST", "/api/auth/register", { name: "Pw Test", email: "pw@example.test", password: "Passw0rd!" }, {}, sb);
  assert.ok(!/hash|salt|password/i.test(JSON.stringify(reg.json.data)));
});

test("one IP cannot flood the server with new sandboxes", async () => {
  const codes = [];
  for (let i = 0; i < 35; i++) {
    const r = await handle({ method: "GET", url: "/api/health", ip: "flooder", headers: { "x-sandbox": "flood-" + Date.now() + "-" + i } });
    codes.push(r.status);
  }
  assert.ok(codes.includes(429), "expected a 429 after 30 new sandboxes in a minute");
  assert.equal(codes[0], 200);
});
