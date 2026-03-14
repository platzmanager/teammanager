import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createTestUserWithEmail,
  deleteTestUser,
  createUserProfile,
  deleteUserProfile,
  createClubViaApi,
  deleteClubViaApi,
  addUserToClub,
  loginAs,
  cleanupPlayers,
} from "./helpers";

const PLAYER_TEST_EMAIL = "players-test@test.local";
const PLAYER_TEST_PASSWORD = "test123456";

let testUserId: string;
let clubId: string;

// Players spanning different age classes (offen, 30, 40, 50, 60)
const TEST_PLAYERS = [
  { first_name: "Anna",     last_name: "Jung",      birth_date: "2000-03-15", skill_level: "5",  gender: "female" },
  { first_name: "Bettina",  last_name: "Dreissig",  birth_date: "1994-07-20", skill_level: "8",  gender: "female" },
  { first_name: "Carla",    last_name: "Vierzig",   birth_date: "1984-01-10", skill_level: "12", gender: "female" },
  { first_name: "Dagmar",   last_name: "Fuenfzig",  birth_date: "1974-11-05", skill_level: "15", gender: "female" },
  { first_name: "Elfriede", last_name: "Sechzig",   birth_date: "1960-06-22", skill_level: "20", gender: "female" },
  { first_name: "Max",      last_name: "Jung",      birth_date: "1999-04-12", skill_level: "3",  gender: "male" },
  { first_name: "Bernd",    last_name: "Dreissig",  birth_date: "1992-09-01", skill_level: "10", gender: "male" },
  { first_name: "Klaus",    last_name: "Fuenfzig",  birth_date: "1970-02-28", skill_level: "18", gender: "male" },
];

test.beforeAll(async () => {
  clubId = await createClubViaApi("Players Test Club", "players-test");
  await cleanupPlayers(clubId);
  testUserId = await createTestUserWithEmail(PLAYER_TEST_EMAIL, PLAYER_TEST_PASSWORD);
  await createUserProfile(testUserId, "admin");
  await addUserToClub(testUserId, clubId);
});

test.afterAll(async () => {
  await cleanupPlayers(clubId);
  await deleteUserProfile(testUserId);
  await deleteTestUser(testUserId);
  await deleteClubViaApi(clubId);
});

async function addPlayer(page: Page, player: typeof TEST_PLAYERS[number]) {
  await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5000 });
  await page.getByRole("button", { name: "Spieler hinzufügen" }).click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  await page.getByLabel("Vorname").fill(player.first_name);
  await page.getByLabel("Nachname").fill(player.last_name);
  await page.getByLabel("Geburtsdatum").fill(player.birth_date);
  await page.getByLabel("LK (1-25)").fill(player.skill_level);
  await page.getByRole("button", { name: "Speichern" }).click();

  // Wait for dialog to close (confirms successful save)
  await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 10000 });
}

test.describe.serial("player management", () => {
  test("create female players", async ({ page }) => {
    await loginAs(page, PLAYER_TEST_EMAIL, PLAYER_TEST_PASSWORD);
    await page.goto("/players-test/players/female/all");

    const femalePlayers = TEST_PLAYERS.filter((p) => p.gender === "female");
    for (const player of femalePlayers) {
      await addPlayer(page, player);
    }

    // Verify all female players are visible in the "offen" tab
    for (const player of femalePlayers) {
      await expect(page.getByText(`${player.last_name}, ${player.first_name}`)).toBeVisible();
    }
  });

  test("create male players", async ({ page }) => {
    await loginAs(page, PLAYER_TEST_EMAIL, PLAYER_TEST_PASSWORD);
    await page.goto("/players-test/players/male/all");

    const malePlayers = TEST_PLAYERS.filter((p) => p.gender === "male");
    for (const player of malePlayers) {
      await addPlayer(page, player);
    }

    for (const player of malePlayers) {
      await expect(page.getByText(`${player.last_name}, ${player.first_name}`)).toBeVisible();
    }
  });

  test("age class filters work", async ({ page }) => {
    await loginAs(page, PLAYER_TEST_EMAIL, PLAYER_TEST_PASSWORD);
    await page.goto("/players-test/players/female/all");

    // Tab "40" should show Carla (42), Dagmar (52), Elfriede (66) but not Anna (26) or Bettina (32)
    await page.getByRole("link", { name: "40" }).click();
    await expect(page.getByText("Vierzig, Carla")).toBeVisible();
    await expect(page.getByText("Fuenfzig, Dagmar")).toBeVisible();
    await expect(page.getByText("Sechzig, Elfriede")).toBeVisible();
    await expect(page.getByText("Jung, Anna")).toBeHidden();

    // Tab "60" should only show Elfriede
    await page.getByRole("link", { name: "60" }).click();
    await expect(page.getByText("Sechzig, Elfriede")).toBeVisible();
    await expect(page.getByText("Vierzig, Carla")).toBeHidden();
  });

  test("registration column is visible", async ({ page }) => {
    await loginAs(page, PLAYER_TEST_EMAIL, PLAYER_TEST_PASSWORD);
    await page.goto("/players-test/players/female/all");

    // Registration column should be visible
    await expect(page.getByRole("columnheader", { name: "Gemeldet" })).toBeVisible();
  });
});
