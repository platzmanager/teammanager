import { test, expect } from "@playwright/test";
import {
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  createTestUserWithEmail,
  deleteTestUser,
  createUserProfile,
  deleteUserProfile,
  createClubViaApi,
  deleteClubViaApi,
  addUserToClub,
  createTeamViaApi,
  deleteTeamViaApi,
  loginAs,
} from "./helpers";

test.describe.configure({ mode: "serial" });

const CLUB_SLUG = "roles-test";
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test123456";
const CAPTAIN_EMAIL = "captain@test.local";
const CAPTAIN_PASSWORD = "test123456";

let adminUserId: string;
let captainUserId: string;
let clubId: string;
let teamId: string;
const createdTeamIds: string[] = [];

test.beforeAll(async () => {
  clubId = await createClubViaApi("Roles Test Club", CLUB_SLUG);

  teamId = await createTeamViaApi("Herren 30 I", "male", "30", clubId);
  createdTeamIds.push(teamId);

  adminUserId = await createTestUserWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
  await createUserProfile(adminUserId, "admin");
  await addUserToClub(adminUserId, clubId);

  captainUserId = await createTestUserWithEmail(CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await createUserProfile(captainUserId, "captain", teamId);
  await addUserToClub(captainUserId, clubId);
});

test.afterAll(async () => {
  if (process.env.KEEP_TEST_DATA) return;
  await deleteUserProfile(adminUserId);
  await deleteUserProfile(captainUserId);
  await deleteTestUser(adminUserId);
  await deleteTestUser(captainUserId);
  for (const id of createdTeamIds) {
    await deleteTeamViaApi(id);
  }
  await deleteClubViaApi(clubId);
});

test("admin sees Teams, Meldeliste, and Import links", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.locator(`a[href="/${CLUB_SLUG}/teams"]`)).toBeVisible();
  await expect(page.locator(`a[href="/${CLUB_SLUG}/players/female/all"]`)).toBeVisible();
  await expect(page.locator(`a[href="/${CLUB_SLUG}/admin/import"]`)).toBeVisible();
});

test("admin can create a team via UI", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/teams`);

  await page.getByRole("button", { name: "Team hinzufügen" }).click();
  await page.getByLabel("Name").fill("Damen 40 I");
  await page.locator("#gender").click();
  await page.getByRole("option", { name: "Damen" }).click();
  await page.locator("#age_class").click();
  await page.getByRole("option", { name: "40" }).click();
  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.getByRole("cell", { name: "Damen 40 I" })).toBeVisible({
    timeout: 5000,
  });

  // Track for cleanup
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?name=eq.Damen 40 I&club_id=eq.${clubId}`,
    {
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
    },
  );
  const teams = await res.json();
  if (teams[0]?.id) createdTeamIds.push(teams[0].id);
});

test("captain can authenticate", async ({ page }) => {
  await loginAs(page, CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await expect(page).toHaveURL(new RegExp(`/${CLUB_SLUG}/`), { timeout: 10000 });
});

test("captain does not see admin-only links", async ({ page }) => {
  await loginAs(page, CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await expect(page.locator(`a[href="/${CLUB_SLUG}/players/female/all"]`)).not.toBeVisible();
  await expect(page.locator(`a[href="/${CLUB_SLUG}/admin/import"]`)).not.toBeVisible();
});
