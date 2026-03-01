import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const TEST_EMAIL = "playwright@test.local";
export const TEST_PASSWORD = "test123456";

export async function createTestUser(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  });
  const data = await res.json();
  expect(data.id).toBeTruthy();
  return data.id;
}

export async function deleteTestUser(userId: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/(female|male)\//, { timeout: 10000 });
}

export async function createTestUserWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await res.json();
  expect(data.id).toBeTruthy();
  return data.id;
}

export async function createUserProfile(
  userId: string,
  role: "admin" | "captain" | "player",
  teamIds?: string | string[],
) {
  const body: Record<string, string> = { id: userId, role };
  // Keep team_id for backward compat
  const ids = teamIds ? (Array.isArray(teamIds) ? teamIds : [teamIds]) : [];
  if (ids.length > 0) body.team_id = ids[0];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  expect(res.ok).toBeTruthy();

  // Insert into user_team_assignments
  for (const teamId of ids) {
    const aRes = await fetch(`${SUPABASE_URL}/rest/v1/user_team_assignments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ user_id: userId, team_id: teamId }),
    });
    expect(aRes.ok).toBeTruthy();
  }
}

export async function deleteUserProfile(userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
}

export async function createTeamViaApi(
  name: string,
  gender: string,
  ageClass: string,
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ name, gender, age_class: ageClass }),
  });
  const data = await res.json();
  expect(data[0]?.id).toBeTruthy();
  return data[0].id;
}

export async function deleteTeamViaApi(id: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/teams?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/(female|male)\/|\/admin/, { timeout: 10000 });
}

export async function cleanupPlayers() {
  await fetch(`${SUPABASE_URL}/rest/v1/players?uuid=neq.00000000-0000-0000-0000-000000000000`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
}
