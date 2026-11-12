import { test, expect } from "@playwright/test";

// A unique X-Sandbox per test file keeps API data isolated from everyone else.
test.use({ extraHTTPHeaders: { "X-Sandbox": "pw-starter-" + Date.now() } });

test("user CRUD lifecycle", async ({ request }) => {
  const created = await request.post("/api/users", { data: { name: "Nina", job: "SDET" } });
  expect(created.status()).toBe(201);
  const { data } = await created.json();

  const patched = await request.patch("/api/users/" + data.id, { data: { job: "Lead" } });
  expect((await patched.json()).data.job).toBe("Lead");

  expect((await request.delete("/api/users/" + data.id)).status()).toBe(204);
  expect((await request.get("/api/users/" + data.id)).status()).toBe(404);
});

test("validation errors have a stable shape", async ({ request }) => {
  const res = await request.post("/api/users", { data: { name: "No job" } });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body).toMatchObject({ success: false, status: 400 });
  expect(body.errors[0].field).toBe("job");
});
