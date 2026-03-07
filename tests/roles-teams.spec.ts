import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import path from "path";
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

  cleanupPlayers,
  loginAs,
} from "./helpers";

test.describe.configure({ mode: "serial" });

const CLUB_SLUG = "roles-test";
const ADMIN_EMAIL = "admin@roles-test.local";
const ADMIN_PASSWORD = "test123456";
const CAPTAIN_EMAIL = "captain@roles-test.local";
const CAPTAIN_PASSWORD = "test123456";

let adminUserId: string;
let captainUserId: string;
let clubId: string;
const createdTeamIds: string[] = [];

test.beforeAll(async () => {
  // Clean slate: delete club if it exists (cascades everything)
  const existing = await fetch(`${SUPABASE_URL}/rest/v1/clubs?slug=eq.${CLUB_SLUG}&select=id`, {
    headers: { apikey: SERVICE_ROLE_KEY },
  });
  const existingData = await existing.json();
  if (existingData[0]?.id) {
    await cleanupPlayers(existingData[0].id);
    // Delete teams (need to remove assignments + matches first)
    const teamsRes = await fetch(`${SUPABASE_URL}/rest/v1/teams?club_id=eq.${existingData[0].id}&select=id`, {
      headers: { apikey: SERVICE_ROLE_KEY },
    });
    for (const t of await teamsRes.json()) {
      await fetch(`${SUPABASE_URL}/rest/v1/user_team_assignments?team_id=eq.${t.id}`, {
        method: "DELETE", headers: { apikey: SERVICE_ROLE_KEY, Prefer: "return=minimal" },
      });
      await fetch(`${SUPABASE_URL}/rest/v1/matches?team_id=eq.${t.id}`, {
        method: "DELETE", headers: { apikey: SERVICE_ROLE_KEY, Prefer: "return=minimal" },
      });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/teams?club_id=eq.${existingData[0].id}`, {
      method: "DELETE", headers: { apikey: SERVICE_ROLE_KEY, Prefer: "return=minimal" },
    });
    await deleteClubViaApi(existingData[0].id);
  }

  clubId = await createClubViaApi("Roles Test Club", CLUB_SLUG);
  await cleanupPlayers(clubId);

  adminUserId = await createTestUserWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
  await createUserProfile(adminUserId, "admin");
  await addUserToClub(adminUserId, clubId);

  // Create teams for all relevant age classes
  const teams = [
    { name: "Herren I", gender: "male", ageClass: "all" },
    { name: "Herren 30 I", gender: "male", ageClass: "30" },
    { name: "Herren 40 I", gender: "male", ageClass: "40" },
    { name: "Damen I", gender: "female", ageClass: "all" },
    { name: "Damen 40 I", gender: "female", ageClass: "40" },
    { name: "Junioren U18 I", gender: "male", ageClass: "u18" },
    { name: "Juniorinnen U18 I", gender: "female", ageClass: "u18" },
    { name: "Bambini U12 I", gender: "male", ageClass: "u12" },
  ];

  for (const t of teams) {
    const id = await createTeamViaApi(t.name, t.gender, t.ageClass, clubId);
    createdTeamIds.push(id);
  }

  // Captain assigned to Herren 30
  captainUserId = await createTestUserWithEmail(CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await createUserProfile(captainUserId, "captain", createdTeamIds[1]); // Herren 30 I
  await addUserToClub(captainUserId, clubId);
});

test.afterAll(async () => {
  if (process.env.KEEP_TEST_DATA) return;
  await cleanupPlayers(clubId);
  await deleteUserProfile(adminUserId);
  await deleteUserProfile(captainUserId);
  await deleteTestUser(adminUserId);
  await deleteTestUser(captainUserId);
  for (const id of createdTeamIds) {
    await deleteTeamViaApi(id);
  }
  await deleteClubViaApi(clubId);
});

// ─── User & Auth Tests ───

test("admin sees Teams and Import links", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.locator(`a[href="/${CLUB_SLUG}/teams"]`)).toBeVisible();
  await expect(page.locator(`a[href="/${CLUB_SLUG}/admin/import"]`)).toBeVisible();
});

test("captain can authenticate", async ({ page }) => {
  await loginAs(page, CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await expect(page).toHaveURL(new RegExp(`/${CLUB_SLUG}/`), { timeout: 10000 });
});

test("captain does not see admin-only links", async ({ page }) => {
  await loginAs(page, CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await expect(page.locator(`a[href="/${CLUB_SLUG}/admin/import"]`)).not.toBeVisible();
});

// ─── CSV Import Tests ───

async function importCsv(page: Page, csvFile: string, gender: "male" | "female") {
  await page.goto(`/${CLUB_SLUG}/admin/import`);
  await expect(page.getByRole("tab", { name: "Spieler" })).toBeVisible();

  // Set gender if needed
  if (gender === "female") {
    // The gender selector is in a section labeled "Geschlecht"
    const genderSection = page.locator("text=Geschlecht").locator("..").locator("..");
    await genderSection.getByRole("combobox").click();
    await page.getByRole("option", { name: "Damen" }).click();
  }

  // Upload CSV
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.resolve(__dirname, "fixtures", csvFile));

  // Wait for import button with row count
  await expect(page.getByRole("button", { name: /Spieler importieren/i })).toBeVisible({ timeout: 5000 });

  // Click import
  await page.getByRole("button", { name: /Spieler importieren/i }).click();

  // Wait for success or error
  const result = page.getByText("Importiert");
  const error = page.getByText("Fehler");
  await expect(result.or(error)).toBeVisible({ timeout: 10000 });
  if (await error.isVisible().catch(() => false)) {
    throw new Error("Import failed with error");
  }
  // Verify non-zero count
  const countEl = page.locator(".text-green-700, .dark\\:text-green-400").first();
  const count = await countEl.textContent();
  expect(parseInt(count ?? "0", 10)).toBeGreaterThan(0);
}

test("import senior male players via CSV", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await importCsv(page, "herren-senior.csv", "male");
});

test("import senior female players via CSV", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await importCsv(page, "damen-senior.csv", "female");
});

test("import youth U18 players via CSV", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await importCsv(page, "youth-u18.csv", "male");
});

test("import youth U12 players via CSV", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await importCsv(page, "youth-u12.csv", "male");
});

// ─── Senior Age Class Filter Tests ───

test("verify imported players exist via UI", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/male/all`);
  await expect(page.getByText("Vierzig, Thomas")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Elf, Tim")).toBeVisible();
});

test("player turning 40 this year is visible in Herren 40", async ({ page }) => {
  // Thomas Vierzig, born 15.03.1986 → age in 2026 = 40 → should be in H40
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/male/all`);
  await expect(page.getByText("Vierzig, Thomas")).toBeVisible({ timeout: 10000 });
  await page.goto(`/${CLUB_SLUG}/players/male/40`);
  await expect(page.getByText("Vierzig, Thomas")).toBeVisible({ timeout: 10000 });
});

test("young player not visible in Herren 40", async ({ page }) => {
  // Michael Jung, born 12.04.1999 → age in 2026 = 27 → should NOT be in H40
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/male/40`);
  await expect(page.getByText("Vierzig, Thomas")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Jung, Michael")).toBeHidden();
});

test("Herren 'all' shows all male players", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/male/all`);
  // All 10 male players (4 senior + 3 U18 + 3 U12) should be visible
  await expect(page.getByText("Vierzig, Thomas")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Jung, Michael")).toBeVisible();
  await expect(page.getByText("Achtzehn, Lukas")).toBeVisible();
  await expect(page.getByText("Elf, Tim")).toBeVisible();
});

test("Damen 40 shows eligible female players", async ({ page }) => {
  // Petra Vierzig born 1986 → age 40 ✅, Monika Fuenfzig born 1974 → age 52 ✅
  // Sabine Dreissig born 1994 → age 32 ❌
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/female/40`);
  await expect(page.getByText("Vierzig, Petra")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Fuenfzig, Monika")).toBeVisible();
  await expect(page.getByText("Dreissig, Sabine")).toBeHidden();
});

// ─── Youth Age Class Filter Tests ───

test("player turning 18 this year is visible in U18", async ({ page }) => {
  // Lukas Achtzehn, born 30.09.2008 → 2026-2008=18 ≤ 18 → eligible ✅
  // Felix born 2009 → 2026-2009=17 ≤ 18 → eligible ✅
  // Anna born 2010 → 2026-2010=16 ≤ 18 → eligible ✅ (girl in male team = allowed)
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/male/u18`);
  await expect(page.getByText("Achtzehn, Lukas")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Siebzehn, Felix")).toBeVisible();
  await expect(page.getByText("Maedchen, Anna")).toBeVisible();
});

test("U12 shows only young enough players", async ({ page }) => {
  // Tim Elf born 2015 → 2026-2015=11 ≤ 12 ✅
  // Lina Zehn born 2016 → 2026-2016=10 ≤ 12 ✅
  // Emma Neun born 2017 → 2026-2017=9 ≤ 12 ✅
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/male/u12`);
  await expect(page.getByText("Elf, Tim")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Zehn, Lina")).toBeVisible();
  await expect(page.getByText("Neun, Emma")).toBeVisible();
  // Senior players should not appear
  await expect(page.getByText("Jung, Michael")).toBeHidden();
});

test("senior players not visible in youth age classes", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/players/male/u18`);
  await expect(page.getByText("Siebzehn, Felix")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Vierzig, Thomas")).toBeHidden();
  await expect(page.getByText("Fuenfzig, Stefan")).toBeHidden();
});

// ─── Team Creation Tests ───

test("admin can create a mixed youth team (U9) - gender hidden", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/teams`);

  await page.getByRole("button", { name: "Team hinzufügen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Select U9 age class
  await page.locator("#age_class").click();
  await page.getByRole("option", { name: "Kleinfeld U9" }).click();

  // Gender dropdown should be hidden for U9 (mixed)
  await expect(page.locator("#gender")).toBeHidden();

  // Name should auto-generate to "Kleinfeld U9 I"
  await expect(page.getByLabel("Name")).toHaveValue(/Kleinfeld U9/);

  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5000 });

  await expect(page.getByRole("cell", { name: /Kleinfeld U9/i }).first()).toBeVisible({ timeout: 5000 });

  // Track for cleanup
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?name=like.*Kleinfeld%20U9*&club_id=eq.${clubId}`,
    { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } },
  );
  const teams = await res.json();
  if (teams[0]?.id) createdTeamIds.push(teams[0].id);
});

test("admin can create a gendered youth team (U15)", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/teams`);

  await page.getByRole("button", { name: "Team hinzufügen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Select U15 age class first
  await page.locator("#age_class").click();
  await page.getByRole("option", { name: "U15" }).click();

  // Gender dropdown should be visible for U15 (not mixed)
  await expect(page.locator("#gender")).toBeVisible();

  // Default gender is male → name should be "Knaben U15 ..."
  await expect(page.getByLabel("Name")).toHaveValue(/Knaben U15/);

  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5000 });

  await expect(page.getByRole("cell", { name: /Knaben U15/i }).first()).toBeVisible({ timeout: 5000 });

  // Track for cleanup
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?name=like.*Knaben%20U15*&club_id=eq.${clubId}`,
    { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } },
  );
  const teams = await res.json();
  if (teams[0]?.id) createdTeamIds.push(teams[0].id);
});
