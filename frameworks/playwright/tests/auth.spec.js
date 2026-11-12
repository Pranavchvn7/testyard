import { test, expect } from "@playwright/test";
import { AuthPage } from "../pages/AuthPage.js";

test("valid login shows the profile", async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.goto();
  await auth.login("practice@testyard.dev", "SecretPass1!");
  await expect(auth.profileName).toHaveText("Practice User");
});

test("wrong password shows an error", async ({ page }) => {
  const auth = new AuthPage(page);
  await auth.goto();
  await auth.login("practice@testyard.dev", "wrong-password");
  await expect(auth.error).toContainText("Incorrect email address or password");
});
