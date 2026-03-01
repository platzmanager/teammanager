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
  removeUserFromClub,
  createTeamViaApi,
  deleteTeamViaApi,
  createPlayerViaApi,
  cleanupPlayers,
  loginAs,
} from "./helpers";

test.describe.configure({ mode: "serial" });

// The seeded default club from migration
const DEFAULT_CLUB_ID = "00000000-0000-0000-0000-000000000001";

const ADMIN_EMAIL = "mt-admin@test.local";
const ADMIN_PASSWORD = "test123456";

let adminUserId: string;
let clubAId: string;
let clubBId: string;
let teamAId: string;
let teamBId: string;
const playerUuids: string[] = [];

test.beforeAll(async () => {
  // Create two test clubs
  clubAId = await createClubViaApi("Testverein Alpha", "tv-alpha");
  clubBId = await createClubViaApi("Testverein Beta", "tv-beta");

  // Create admin user assigned to both clubs
  adminUserId = await createTestUserWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
  await createUserProfile(adminUserId, "admin");
  await addUserToClub(adminUserId, clubAId);
  await addUserToClub(adminUserId, clubBId);

  // Create a team in each club (same name to test uniqueness per club)
  teamAId = await createTeamViaApi("Herren 30 I", "male", "30", clubAId);
  teamBId = await createTeamViaApi("Herren 30 I", "male", "30", clubBId);

  // Create a player in club A
  const pA = await createPlayerViaApi(clubAId, {
    first_name: "Anna",
    last_name: "Alpha",
    birth_date: "1994-05-10",
    gender: "female",
    skill_level: 5,
  });
  playerUuids.push(pA);

  // Create a player in club B
  const pB = await createPlayerViaApi(clubBId, {
    first_name: "Ben",
    last_name: "Beta",
    birth_date: "1992-08-20",
    gender: "female",
    skill_level: 8,
  });
  playerUuids.push(pB);
});

test.afterAll(async () => {
  if (process.env.KEEP_TEST_DATA) return;
  await cleanupPlayers(clubAId);
  await cleanupPlayers(clubBId);
  await deleteTeamViaApi(teamAId);
  await deleteTeamViaApi(teamBId);
  await removeUserFromClub(adminUserId, clubAId);
  await removeUserFromClub(adminUserId, clubBId);
  await deleteUserProfile(adminUserId);
  await deleteTestUser(adminUserId);
  await deleteClubViaApi(clubAId);
  await deleteClubViaApi(clubBId);
});

test("multi-club user sees club-select page after login", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  // User has two clubs, so should land on club-select
  await expect(page).toHaveURL(/\/club-select/, { timeout: 15000 });
  await expect(page.getByText("Club auswählen")).toBeVisible();
  await expect(page.getByText("Testverein Alpha")).toBeVisible();
  await expect(page.getByText("Testverein Beta")).toBeVisible();
});

test("selecting a club sets context and redirects", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/club-select/, { timeout: 15000 });

  // Select club Alpha
  await page.getByRole("button", { name: "Testverein Alpha" }).click();
  await expect(page).toHaveURL(/\/(female|male)/, { timeout: 10000 });

  // Header should show club name
  await expect(page.getByText("Testverein Alpha")).toBeVisible();
});

test("data isolation: club A player visible, club B player hidden", async ({ page }) => {
  // Login and select club A
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/club-select/, { timeout: 15000 });
  await page.getByRole("button", { name: "Testverein Alpha" }).click();
  await expect(page).toHaveURL(/\/(female|male)/, { timeout: 10000 });

  // Go to female players
  await page.goto("/female/all");
  await page.waitForLoadState("networkidle");

  // Club A player should be visible
  await expect(page.getByText("Alpha, Anna")).toBeVisible({ timeout: 10000 });

  // Club B player should NOT be visible
  await expect(page.getByText("Beta, Ben")).not.toBeVisible();
});

test("club switching via user menu", async ({ page }) => {
  // Login and select club A first
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/club-select/, { timeout: 15000 });
  await page.getByRole("button", { name: "Testverein Alpha" }).click();
  await expect(page).toHaveURL(/\/(female|male)/, { timeout: 10000 });

  // Open user menu and click "Club wechseln"
  await page.locator("button").filter({ hasText: /^[A-Z]{1,2}$/ }).click();
  await page.getByText("Club wechseln").click();
  await expect(page).toHaveURL(/\/club-select/, { timeout: 10000 });

  // Select club B
  await page.getByRole("button", { name: "Testverein Beta" }).click();
  await expect(page).toHaveURL(/\/(female|male)/, { timeout: 10000 });

  // Header should show club B
  await expect(page.getByText("Testverein Beta")).toBeVisible();

  // Navigate to female players - should see club B player, not club A
  await page.goto("/female/all");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Beta, Ben")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Alpha, Anna")).not.toBeVisible();
});

test("teams are scoped per club", async ({ page }) => {
  // Login and select club A
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/club-select/, { timeout: 15000 });
  await page.getByRole("button", { name: "Testverein Alpha" }).click();
  await expect(page).toHaveURL(/\/(female|male)/, { timeout: 10000 });

  // Go to admin teams page
  await page.goto("/admin/teams");

  // Should see the team for club A
  await expect(page.getByRole("cell", { name: "Herren 30 I" })).toBeVisible({
    timeout: 5000,
  });
});

test("single-club user auto-resolves without club-select", async ({ page }) => {
  // Create a single-club user
  const singleEmail = "mt-single@test.local";
  const singlePassword = "test123456";
  const singleUserId = await createTestUserWithEmail(singleEmail, singlePassword);
  await createUserProfile(singleUserId, "admin", undefined, { skipDefaultClub: true });
  await addUserToClub(singleUserId, clubAId);

  try {
    await page.goto("/login");
    await page.fill('input[type="email"]', singleEmail);
    await page.fill('input[type="password"]', singlePassword);
    await page.click('button[type="submit"]');

    // Single club user should NOT see club-select, should go directly to app
    await expect(page).toHaveURL(/\/(female|male)/, { timeout: 15000 });

    // Header should show the club name
    await expect(page.getByText("Testverein Alpha")).toBeVisible();
  } finally {
    await removeUserFromClub(singleUserId, clubAId);
    await deleteUserProfile(singleUserId);
    await deleteTestUser(singleUserId);
  }
});

test("same player name in two clubs both succeed (CSV import isolation)", async ({ page }) => {
  // Create same-named player in club B (one already exists in club A from beforeAll)
  const dupUuid = await createPlayerViaApi(clubBId, {
    first_name: "Anna",
    last_name: "Alpha",
    birth_date: "1994-05-10",
    gender: "female",
    skill_level: 5,
  });
  playerUuids.push(dupUuid);

  // Login as club B
  await page.goto("/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/club-select/, { timeout: 15000 });
  await page.getByRole("button", { name: "Testverein Beta" }).click();
  await expect(page).toHaveURL(/\/(female|male)/, { timeout: 10000 });

  await page.goto("/female/all");

  // Should see the duplicate player in club B
  await expect(page.getByText("Alpha, Anna")).toBeVisible({ timeout: 5000 });
});
