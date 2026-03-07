import { test, expect } from "@playwright/test";
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
  loginAs,
} from "./helpers";

test.describe.configure({ mode: "serial" });

const CLUB_SLUG = "members-events-test";
const ADMIN_EMAIL = "admin@members-events.local";
const ADMIN_PASSWORD = "test123456";
const CAPTAIN_EMAIL = "captain@members-events.local";
const CAPTAIN_PASSWORD = "test123456";

let adminUserId: string;
let captainUserId: string;
let clubId: string;
let teamId: string;

const serviceHeaders = () => ({
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
});
const serviceHeadersJson = () => ({
  ...serviceHeaders(),
  "Content-Type": "application/json",
});

test.beforeAll(async () => {
  // Clean slate
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/clubs?slug=eq.${CLUB_SLUG}&select=id`,
    { headers: serviceHeaders() }
  );
  const existingData = await existing.json();
  if (existingData[0]?.id) {
    // Delete members first
    await fetch(
      `${SUPABASE_URL}/rest/v1/members?club_id=eq.${existingData[0].id}`,
      { method: "DELETE", headers: { ...serviceHeaders(), Prefer: "return=minimal" } }
    );
    // Delete events
    await fetch(
      `${SUPABASE_URL}/rest/v1/events?club_id=eq.${existingData[0].id}`,
      { method: "DELETE", headers: { ...serviceHeaders(), Prefer: "return=minimal" } }
    );
    // Delete teams
    const teamsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/teams?club_id=eq.${existingData[0].id}&select=id`,
      { headers: serviceHeaders() }
    );
    for (const t of await teamsRes.json()) {
      await fetch(`${SUPABASE_URL}/rest/v1/user_team_assignments?team_id=eq.${t.id}`, {
        method: "DELETE",
        headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/teams?club_id=eq.${existingData[0].id}`, {
      method: "DELETE",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
    });
    await deleteClubViaApi(existingData[0].id);
  }

  // Clean up test users that may exist from previous runs
  for (const email of [ADMIN_EMAIL, CAPTAIN_EMAIL, "newmember@test.local"]) {
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: serviceHeaders(),
    });
    const listData = await listRes.json();
    const user = (listData.users ?? []).find((u: { email: string }) => u.email === email);
    if (user) {
      await deleteUserProfile(user.id);
      await deleteTestUser(user.id);
    }
  }

  clubId = await createClubViaApi("Members Events Test Club", CLUB_SLUG);
  adminUserId = await createTestUserWithEmail(ADMIN_EMAIL, ADMIN_PASSWORD);
  await createUserProfile(adminUserId, "admin");
  await addUserToClub(adminUserId, clubId);

  teamId = await createTeamViaApi("Herren I", "male", "all", clubId);

  captainUserId = await createTestUserWithEmail(CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await createUserProfile(captainUserId, "captain", teamId);
  await addUserToClub(captainUserId, clubId);

  // Create member records for admin and captain so RSVP works
  await fetch(`${SUPABASE_URL}/rest/v1/members`, {
    method: "POST",
    headers: { ...serviceHeadersJson(), Prefer: "return=minimal" },
    body: JSON.stringify([
      { club_id: clubId, user_id: adminUserId, first_name: "Admin", last_name: "User", email: ADMIN_EMAIL },
      { club_id: clubId, user_id: captainUserId, first_name: "Captain", last_name: "User", email: CAPTAIN_EMAIL },
    ]),
  });
});

test.afterAll(async () => {
  if (process.env.KEEP_TEST_DATA) return;
  // Clean up members
  await fetch(`${SUPABASE_URL}/rest/v1/members?club_id=eq.${clubId}`, {
    method: "DELETE",
    headers: { ...serviceHeaders(), Prefer: "return=minimal" },
  });
  // Clean up events
  await fetch(`${SUPABASE_URL}/rest/v1/events?club_id=eq.${clubId}`, {
    method: "DELETE",
    headers: { ...serviceHeaders(), Prefer: "return=minimal" },
  });
  await deleteUserProfile(adminUserId);
  await deleteUserProfile(captainUserId);
  await deleteTestUser(adminUserId);
  await deleteTestUser(captainUserId);
  // Clean up registered user
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: serviceHeaders(),
  });
  const listData = await listRes.json();
  const newUser = (listData.users ?? []).find(
    (u: { email: string }) => u.email === "newmember@test.local"
  );
  if (newUser) {
    await deleteUserProfile(newUser.id);
    await deleteTestUser(newUser.id);
  }
  await deleteTeamViaApi(teamId);
  await deleteClubViaApi(clubId);
});

// ─── Navigation Tests ───

test("admin sees Mitglieder and Termine nav links", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await expect(page.locator(`a[href="/${CLUB_SLUG}/admin/members"]`)).toBeVisible();
  await expect(page.locator(`a[href="/${CLUB_SLUG}/events"]`)).toBeVisible();
});

test("captain sees Termine but not Mitglieder", async ({ page }) => {
  await loginAs(page, CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await expect(page.locator(`a[href="/${CLUB_SLUG}/events"]`)).toBeVisible();
  await expect(page.locator(`a[href="/${CLUB_SLUG}/admin/members"]`)).not.toBeVisible();
});

// ─── Members Admin Page Tests ───

test("admin can access members page", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/admin/members`);
  await expect(page.getByRole("heading", { name: "Mitglieder", exact: true })).toBeVisible({ timeout: 10000 });
  // Should show the backfilled admin + captain members
  await expect(page.getByRole("heading", { name: "Mitglieder importieren" })).toBeVisible();
});

test("admin can import members via CSV", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/admin/members`);
  await expect(page.getByText("Mitglieder importieren")).toBeVisible({ timeout: 10000 });

  // Upload CSV
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.resolve(__dirname, "fixtures", "members.csv"));

  // Wait for preview
  await expect(page.getByText("3 Mitglieder erkannt")).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("cell", { name: "Mustermann" }).first()).toBeVisible();

  // Import
  await page.getByRole("button", { name: /Mitglieder importieren/i }).click();

  // Wait for result
  await expect(page.getByText("Importiert")).toBeVisible({ timeout: 10000 });
});

test("imported members appear in member list", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/admin/members`);
  await expect(page.getByText("Mustermann, Max")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Mustermann, Erika")).toBeVisible();
  await expect(page.getByText("Meier, Hans")).toBeVisible();
});

// ─── Invite Link Tests ───

let inviteToken: string;

test("captain can generate invite link on team page", async ({ page }) => {
  await loginAs(page, CAPTAIN_EMAIL, CAPTAIN_PASSWORD);

  // Get the team slug to navigate directly
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?id=eq.${teamId}&select=slug`,
    { headers: serviceHeaders() }
  );
  const teamData = await res.json();
  const teamSlug = teamData[0]?.slug;

  await page.goto(`/${CLUB_SLUG}/team/male/${teamSlug}`);
  await expect(page.getByRole("heading", { name: "Einladungslink" })).toBeVisible({ timeout: 10000 });

  // Generate invite link
  await page.getByRole("button", { name: "Einladungslink erstellen" }).click();

  // Wait for the readonly input to appear (contains the invite URL)
  const inviteInput = page.locator('input[readonly]');
  await expect(inviteInput).toBeVisible({ timeout: 10000 });

  // Extract the token from the invite URL
  const inviteUrl = await inviteInput.inputValue();
  expect(inviteUrl).toContain("/join/");
  inviteToken = inviteUrl.split("/join/")[1];
  expect(inviteToken).toBeTruthy();
});

// ─── Registration Flow Tests ───

test("public join page shows registration form", async ({ browser }) => {
  // Use a fresh context (no auth cookies) for the public join page
  const context = await browser.newContext();
  const page = await context.newPage();

  // Use the token from previous test (or fetch/create from DB)
  if (!inviteToken) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/teams?id=eq.${teamId}&select=invite_token`,
      { headers: serviceHeaders() }
    );
    const data = await res.json();
    inviteToken = data[0]?.invite_token;
    if (!inviteToken) {
      // Generate one via API
      const token = crypto.randomUUID();
      await fetch(`${SUPABASE_URL}/rest/v1/teams?id=eq.${teamId}`, {
        method: "PATCH",
        headers: { ...serviceHeadersJson(), Prefer: "return=minimal" },
        body: JSON.stringify({ invite_token: token }),
      });
      inviteToken = token;
    }
  }
  expect(inviteToken).toBeTruthy();

  const response = await page.goto(`/join/${inviteToken}`);
  // Debug: log what we actually got
  const body = await page.textContent("body");
  console.log("Join page status:", response?.status(), "body preview:", body?.substring(0, 200));

  await expect(page.getByRole("heading", { name: "Registrieren" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Herren I")).toBeVisible();
  await expect(page.getByLabel("Vorname")).toBeVisible();
  await expect(page.getByLabel("Nachname")).toBeVisible();
  await expect(page.getByLabel("E-Mail")).toBeVisible();
  await expect(page.getByLabel("Passwort")).toBeVisible();
  await context.close();
});

test("new member can register via invite link", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`/join/${inviteToken}`);
  await expect(page.getByLabel("Vorname")).toBeVisible({ timeout: 10000 });

  await page.getByLabel("Vorname").fill("Neues");
  await page.getByLabel("Nachname").fill("Mitglied");
  await page.getByLabel("Geburtsdatum").fill("1995-06-15");
  await page.getByLabel("E-Mail").fill("newmember@test.local");
  await page.getByLabel("Passwort").fill("test123456");

  await page.getByRole("button", { name: "Registrieren" }).click();

  // Should show success message
  await expect(page.getByText("Registrierung erfolgreich")).toBeVisible({ timeout: 15000 });
  await context.close();
});

test("registered member appears in admin members list", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/admin/members`);
  await expect(page.getByText("Mitglied, Neues")).toBeVisible({ timeout: 10000 });
});

test("invalid invite token shows 404", async ({ page }) => {
  const response = await page.goto("/join/invalid-token-12345");
  expect(response?.status()).toBe(404);
});

// ─── Events Tests ───

test("events page is accessible", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/events`);
  await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible({ timeout: 10000 });
});

test("admin can create a one-time event", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/events`);
  await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible({ timeout: 10000 });

  // Click "Neuer Termin"
  await page.getByRole("button", { name: "Neuer Termin" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

  // Fill form
  await page.getByLabel("Titel").fill("Saisonabschluss");
  await page.getByLabel("Beschreibung").fill("Grillabend zum Saisonende");
  await page.getByLabel("Ort").fill("Vereinsheim");
  await page.getByLabel("Datum").fill("2026-07-15");
  await page.getByLabel("Von").fill("18:00");
  await page.getByLabel("Bis").fill("22:00");

  // Submit
  await page.getByRole("button", { name: "Termin erstellen" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 });

  // Event should appear in the list
  await expect(page.getByText("Saisonabschluss")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Vereinsheim")).toBeVisible();
});

test("captain can create a recurring training event", async ({ page }) => {
  await loginAs(page, CAPTAIN_EMAIL, CAPTAIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/events`);
  await expect(page.getByRole("heading", { name: "Termine" })).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Neuer Termin" }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

  await page.getByLabel("Titel").fill("Mannschaftstraining");
  await page.getByLabel("Ort").fill("Platz 1-3");
  await page.getByLabel("Datum").fill("2026-04-01");
  await page.getByLabel("Von").fill("17:00");
  await page.getByLabel("Bis").fill("19:00");

  // Event type defaults to "Training" — no change needed

  // Set weekly recurrence
  // The recurrence select is the second select trigger in the dialog
  const recurrenceSelect = page.getByRole("dialog").locator("button[role='combobox']").nth(1);
  await recurrenceSelect.click();
  await page.getByRole("option", { name: "Wöchentlich" }).click();

  // Set end date
  await page.getByLabel("Wiederholung bis").fill("2026-05-31");

  await page.getByRole("button", { name: "Termin erstellen" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10000 });

  // Should see at least one occurrence
  await expect(page.getByText("Mannschaftstraining").first()).toBeVisible({ timeout: 10000 });
});

// ─── RSVP Tests ───

test("member can RSVP to an event", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/events`);

  // Find the Saisonabschluss event and click Zusage
  const eventCard = page.locator("text=Saisonabschluss").locator("..").locator("..");
  const zusageButton = eventCard.getByRole("button", { name: "Zusage" });
  await expect(zusageButton).toBeVisible({ timeout: 10000 });
  await zusageButton.click();

  // Button should be highlighted (green active state)
  await expect(zusageButton).toHaveClass(/bg-green/, { timeout: 5000 });
});

test("member can change RSVP to Absage", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/events`);

  const eventCard = page.locator("text=Saisonabschluss").locator("..").locator("..");
  const absageButton = eventCard.getByRole("button", { name: "Absage" });
  await expect(absageButton).toBeVisible({ timeout: 10000 });
  await absageButton.click();

  // Absage button should now be highlighted (red)
  await expect(absageButton).toHaveClass(/bg-red/, { timeout: 5000 });
});

// ─── Calendar Tests ───

test("calendar page is accessible", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/events/calendar`);
  await expect(page.getByText("Kalender")).toBeVisible({ timeout: 10000 });
});

test("calendar page can be reached from events page", async ({ page }) => {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto(`/${CLUB_SLUG}/events`);
  await page.getByRole("link", { name: "Kalender" }).click();
  await expect(page).toHaveURL(new RegExp(`/${CLUB_SLUG}/events/calendar`), { timeout: 10000 });
});
