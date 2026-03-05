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

export async function createTestUserWithEmail(
  email: string,
  password: string,
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {

      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("createTestUserWithEmail failed:", res.status, JSON.stringify(data));
  }
  // User may already exist from a previous failed run
  if (data.id) return data.id;
  if (data.msg?.includes("already") || data.message?.includes("already")) {
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: {
  
        apikey: SERVICE_ROLE_KEY,
      },
    });
    expect(listRes.ok).toBeTruthy();
    const listData = await listRes.json();
    const existing = (listData.users ?? []).find(
      (u: { email: string }) => u.email === email,
    );
    expect(existing?.id).toBeTruthy();
    return existing.id;
  }
  expect(data.id).toBeTruthy();
  return data.id;
}

export async function deleteTestUser(userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_clubs?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: {

      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {

      apikey: SERVICE_ROLE_KEY,
    },
  });
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/[^/]+\/(teams|players|admin)|\/club-select/, {
    timeout: 15000,
  });
}

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/[^/]+\/(teams|players|admin)|\/club-select/, {
    timeout: 15000,
  });
}

export async function createUserProfile(
  userId: string,
  role: "admin" | "captain" | "player",
  teamIds?: string | string[],
) {
  const body: Record<string, string> = { id: userId, role };
  const ids = teamIds ? (Array.isArray(teamIds) ? teamIds : [teamIds]) : [];
  if (ids.length > 0) body.team_id = ids[0];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
    method: "POST",
    headers: {

      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });
  expect(res.ok).toBeTruthy();

  for (const teamId of ids) {
    const assignRes = await fetch(`${SUPABASE_URL}/rest/v1/user_team_assignments`, {
      method: "POST",
      headers: {
  
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify({ user_id: userId, team_id: teamId }),
    });
    expect(assignRes.ok).toBeTruthy();
  }
}

export async function deleteUserProfile(userId: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/user_clubs?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: {

      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
  await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: "DELETE",
    headers: {

      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
}

// --- Club helpers ---

export async function createClubViaApi(
  name: string,
  slug: string,
): Promise<string> {
  // Check if club already exists (leftover from a previous run)
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/clubs?slug=eq.${slug}&select=id`,
    {
      headers: {
  
        apikey: SERVICE_ROLE_KEY,
      },
    },
  );
  const existingData = await existing.json();
  if (existingData[0]?.id) {
    return existingData[0].id;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/clubs`, {
    method: "POST",
    headers: {

      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=representation",
    },
    body: JSON.stringify({ name, slug }),
  });
  const data = await res.json();
  expect(data[0]?.id).toBeTruthy();
  return data[0].id;
}

export async function deleteClubViaApi(id: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/clubs?id=eq.${id}`, {
    method: "DELETE",
    headers: {

      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
}

export async function addUserToClub(userId: string, clubId: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_clubs`, {
    method: "POST",
    headers: {

      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify({ user_id: userId, club_id: clubId }),
  });
  expect(res.ok).toBeTruthy();
}

export async function removeUserFromClub(userId: string, clubId: string) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/user_clubs?user_id=eq.${userId}&club_id=eq.${clubId}`,
    {
      method: "DELETE",
      headers: {
  
        apikey: SERVICE_ROLE_KEY,
        Prefer: "return=minimal",
      },
    },
  );
}

// --- Team helpers ---

export async function createTeamViaApi(
  name: string,
  gender: string,
  ageClass: string,
  clubId: string,
): Promise<string> {
  // Check if team already exists
  const existing = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?name=eq.${encodeURIComponent(name)}&club_id=eq.${clubId}&select=id`,
    {
      headers: {
  
        apikey: SERVICE_ROLE_KEY,
      },
    },
  );
  const existingData = await existing.json();
  if (existingData[0]?.id) return existingData[0].id;

  // Get next rank for this group
  const rankRes = await fetch(
    `${SUPABASE_URL}/rest/v1/teams?club_id=eq.${clubId}&gender=eq.${gender}&age_class=eq.${ageClass}&select=rank&order=rank.desc&limit=1`,
    {
      headers: {
  
        apikey: SERVICE_ROLE_KEY,
      },
    },
  );
  const rankData = await rankRes.json();
  const nextRank = ((rankData[0]?.rank as number) ?? 0) + 1;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
    method: "POST",
    headers: {

      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      name,
      gender,
      age_class: ageClass,
      slug: ageClass + "-" + Date.now(),
      club_id: clubId,
      rank: nextRank,
    }),
  });
  const data = await res.json();
  expect(data[0]?.id).toBeTruthy();
  return data[0].id;
}

export async function deleteTeamViaApi(id: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/teams?id=eq.${id}`, {
    method: "DELETE",
    headers: {

      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
}

// --- Player helpers ---

export async function createPlayerViaApi(
  clubId: string,
  player: {
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: string;
    skill_level?: number;
  },
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
    method: "POST",
    headers: {

      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...player,
      club_id: clubId,
      sort_position: 0,
    }),
  });
  const data = await res.json();
  expect(data[0]?.uuid).toBeTruthy();
  return data[0].uuid;
}

// --- Mailpit helpers (local Supabase uses Mailpit on port 54324) ---

const MAILPIT_URL = "http://127.0.0.1:54324";

export async function deleteAllEmails() {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

export async function inviteUser(email: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
    method: "POST",
    headers: {

      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email,
      data: {},
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Invite failed: ${JSON.stringify(data)}`);
  return data;
}

export async function getLatestEmail(
  email: string,
  timeoutMs = 10000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const listRes = await fetch(
      `${MAILPIT_URL}/api/v1/messages?query=to:${encodeURIComponent(email)}`,
    );
    const list = await listRes.json();
    if (list.messages?.length > 0) {
      const msgId = list.messages[0].ID;
      const msgRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msgId}`);
      const msg = await msgRes.json();
      return msg.HTML || msg.Text || "";
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email for ${email} within ${timeoutMs}ms`);
}

export function extractLinkFromEmail(html: string): string {
  // Supabase invite emails contain a confirmation link
  const match = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/);
  if (!match) {
    // Try any link containing "token"
    const tokenMatch = html.match(/href="([^"]*token=[^"]*)"/);
    if (!tokenMatch) throw new Error("No invite link found in email HTML");
    return tokenMatch[1].replace(/&amp;/g, "&");
  }
  // Unescape HTML entities (href values contain &amp; for &)
  return match[1].replace(/&amp;/g, "&");
}

export async function cleanupPlayers(clubId?: string) {
  const filter = clubId
    ? `club_id=eq.${clubId}`
    : `uuid=neq.00000000-0000-0000-0000-000000000000`;
  await fetch(`${SUPABASE_URL}/rest/v1/players?${filter}`, {
    method: "DELETE",
    headers: {

      apikey: SERVICE_ROLE_KEY,
      Prefer: "return=minimal",
    },
  });
}
