import { test, expect } from "@playwright/test";
import {
  createTestUser,
  deleteTestUser,
  createUserProfile,
  deleteUserProfile,
  createClubViaApi,
  deleteClubViaApi,
  addUserToClub,
  login,
} from "./helpers";

let testUserId: string;
let clubId: string;

test.beforeAll(async () => {
  clubId = await createClubViaApi("Auth Test Club", "auth-test");
  testUserId = await createTestUser();
  await createUserProfile(testUserId, "admin");
  await addUserToClub(testUserId, clubId);
});

test.afterAll(async () => {
  await deleteUserProfile(testUserId);
  await deleteTestUser(testUserId);
  await deleteClubViaApi(clubId);
});

test("sign in and reach protected page", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("link", { name: "Teams" })).toBeVisible();
});
