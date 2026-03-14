import { test, expect } from "@playwright/test";
import {
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  deleteAllEmails,
  inviteUser,
  getLatestEmail,
  deleteTestUser,
  createUserProfile,
  createClubViaApi,
  deleteClubViaApi,
  addUserToClub,
  deleteUserProfile,
} from "./helpers";

const INVITE_EMAIL = "invite-test@test.local";
let userId: string | undefined;
let clubId: string;

test.beforeAll(async () => {
  // Clean up leftover user from previous runs
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
  const listData = await listRes.json();
  const existing = listData.users?.find(
    (u: { email: string }) => u.email === INVITE_EMAIL,
  );
  if (existing) {
    await deleteUserProfile(existing.id);
    await deleteTestUser(existing.id);
  }
  clubId = await createClubViaApi("Invite Test Club", "invite-test");
});

test.afterAll(async () => {
  if (userId) {
    await deleteUserProfile(userId);
    await deleteTestUser(userId);
  }
  await deleteClubViaApi(clubId);
});

function extractCallbackLink(html: string): string {
  // Our custom template links to /auth/callback?token_hash=...&type=invite
  const match = html.match(/href="([^"]*\/auth\/callback[^"]*)"/);
  if (!match) throw new Error("No callback link found in email HTML");
  return match[1].replace(/&amp;/g, "&");
}

test("invite flow: email → set password → protected page", async ({
  page,
}) => {
  // 1. Clear mailbox & invite user
  await deleteAllEmails();
  await inviteUser(INVITE_EMAIL);

  // 2. Get invite email and extract the callback link
  const html = await getLatestEmail(INVITE_EMAIL);
  const callbackLink = extractCallbackLink(html);
  console.log("Callback link:", callbackLink);

  // 3. Navigate to the callback link. Extract the path to use Playwright's baseURL.
  const callbackPath = new URL(callbackLink).pathname + new URL(callbackLink).search;
  await page.goto(callbackPath, { waitUntil: "commit" });

  // 4. Should redirect to /auth/set-password after verifyOtp
  await expect(page).toHaveURL(/\/auth\/set-password/, { timeout: 10000 });

  // 5. Look up user for profile setup
  const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  });
  const adminData = await adminRes.json();
  const user = adminData.users?.find(
    (u: { email: string }) => u.email === INVITE_EMAIL,
  );
  expect(user).toBeTruthy();
  userId = user.id;

  await createUserProfile(userId!, "player");
  await addUserToClub(userId!, clubId);

  // 6. Set password
  await page.fill("input#password", "TestPassword123!");
  await page.fill("input#confirmPassword", "TestPassword123!");
  await page.click('button[type="submit"]');

  // 7. Should redirect to protected page
  await expect(page).toHaveURL(/\/[^/]+\/teams|\/club-select/, {
    timeout: 10000,
  });
});
