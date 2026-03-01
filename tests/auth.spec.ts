import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, login } from "./helpers";

let testUserId: string;

test.beforeAll(async () => {
  testUserId = await createTestUser();
});

test.afterAll(async () => {
  await deleteTestUser(testUserId);
});

test("sign in and reach protected page", async ({ page }) => {
  await login(page);
  await expect(page.locator("text=Meldeliste")).toBeVisible();
});
