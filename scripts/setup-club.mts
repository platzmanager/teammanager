/**
 * Admin script for club setup and management.
 *
 * Usage:
 *   pnpm setup-club          # local
 *   pnpm setup-club:prod     # production
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as readline from "node:readline";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  apikey: SERVICE_ROLE_KEY,
  "Content-Type": "application/json",
};

// --- Helpers ---

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function choose(question: string, options: string[]): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    const optionList = options.map((o, i) => `  ${i + 1}) ${o}`).join("\n");
    rl.question(`${question}\n${optionList}\n> `, (answer) => {
      rl.close();
      const idx = parseInt(answer) - 1;
      resolve(options[idx] ?? options[0]);
    });
  });
}

async function post<T>(
  path: string,
  body: Record<string, unknown>,
  prefer = "return=representation",
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: { ...headers, Prefer: prefer },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`API error ${path}: ${text}`);
  }
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`API error ${path}: ${JSON.stringify(data)}`);
  }
  return data as T;
}

// --- Actions ---

async function pickClub(): Promise<{ id: string; name: string }> {
  const clubs = await get<{ id: string; name: string }[]>(
    "/rest/v1/clubs?select=id,name&order=name",
  );
  if (clubs.length === 0) throw new Error("No clubs found");

  console.log("\nExisting clubs:");
  clubs.forEach((c, i) => console.log(`  ${i + 1}) ${c.name}`));
  const answer = await prompt("Select club: ");
  const idx = parseInt(answer) - 1;
  const club = clubs[idx];
  if (!club) throw new Error("Invalid selection");
  return club;
}

async function pickTeam(
  clubId: string,
): Promise<{ id: string; name: string }> {
  const teams = await get<{ id: string; name: string }[]>(
    `/rest/v1/teams?select=id,name&club_id=eq.${clubId}&order=name`,
  );
  if (teams.length === 0) throw new Error("No teams found for this club");

  console.log("\nExisting teams:");
  teams.forEach((t, i) => console.log(`  ${i + 1}) ${t.name}`));
  const answer = await prompt("Select team: ");
  const idx = parseInt(answer) - 1;
  const team = teams[idx];
  if (!team) throw new Error("Invalid selection");
  return team;
}

async function createClub(): Promise<{ id: string; name: string }> {
  const name = await prompt("Club name: ");
  const slug = await prompt("Club slug (e.g. tc-musterstadt): ");

  const [club] = await post<[{ id: string }]>("/rest/v1/clubs", {
    name,
    slug,
  });
  console.log(`Club created: ${name} (${club.id})`);
  return { id: club.id, name };
}

async function createTeam(
  clubId: string,
): Promise<{ id: string; name: string }> {
  const name = await prompt("Team name (e.g. Damen 1): ");
  const gender = await choose("Gender:", ["female", "male"]);
  const ageClass = await choose("Age class:", [
    "all",
    "30",
    "40",
    "50",
    "60",
  ]);

  const [team] = await post<[{ id: string }]>("/rest/v1/teams", {
    name,
    gender,
    age_class: ageClass,
    club_id: clubId,
  });
  console.log(`Team created: ${name} (${team.id})`);
  return { id: team.id, name };
}

async function upsert<T>(
  path: string,
  body: Record<string, unknown>,
  prefer = "return=minimal",
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: `${prefer},resolution=merge-duplicates`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`API error ${path}: ${text}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function inviteCaptain(clubId: string, teamId: string): Promise<void> {
  const email = await prompt("Captain email: ");

  // Check if user already exists in auth
  const existing = await get<{ id: string }[]>(
    `/rest/v1/user_profiles?select=id&id=in.(select id from auth.users where email=eq.${encodeURIComponent(email)})`,
  ).catch(() => [] as { id: string }[]);

  let userId: string;

  // Try to find existing user via the admin API
  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers,
  });
  const listData = await listRes.json();
  const existingUser = (listData.users ?? []).find(
    (u: { email: string }) => u.email === email,
  );

  if (existingUser) {
    userId = existingUser.id;
    console.log(`User already exists: ${email} (${userId})`);
  } else {
    const user = await post<{ id: string }>("/auth/v1/invite", { email });
    userId = user.id;
    console.log(`User invited: ${email} (${userId})`);
  }

  // Create profile if it doesn't exist (don't overwrite existing role)
  const [existingProfile] = await get<{ id: string }[]>(
    `/rest/v1/user_profiles?id=eq.${userId}&select=id`,
  );
  if (!existingProfile) {
    await post(
      "/rest/v1/user_profiles",
      { id: userId, role: "captain", team_id: teamId },
      "return=minimal",
    );
  }

  // Upsert team assignment (composite PK handles duplicates)
  await upsert(
    "/rest/v1/user_team_assignments",
    { user_id: userId, team_id: teamId },
  );

  // Upsert club membership (composite PK handles duplicates)
  await upsert(
    "/rest/v1/user_clubs",
    { user_id: userId, club_id: clubId },
  );

  console.log("Captain profile, team assignment, and club membership created.");
}

async function resortPlayers(clubId: string): Promise<void> {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("Missing APP_URL env var");
  }
  const email = await prompt("Admin email: ");
  const password = await prompt("Admin password: ");

  // Sign in via Supabase auth to get a session
  const authRes = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );

  if (!authRes.ok) {
    const err = await authRes.text();
    throw new Error(`Auth failed: ${err}`);
  }

  const session = await authRes.json();

  // Build Supabase auth cookie (matches @supabase/ssr raw cookie format)
  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieValue = JSON.stringify(session);

  // Cookie value may exceed browser limits, use chunking like @supabase/ssr
  const encoded = encodeURIComponent(cookieValue);
  const CHUNK_SIZE = 3180;
  const cookieParts: string[] = [];

  if (encoded.length <= CHUNK_SIZE) {
    cookieParts.push(`${cookieName}=${encoded}`);
  } else {
    let remaining = encoded;
    let i = 0;
    while (remaining.length > 0) {
      cookieParts.push(`${cookieName}.${i}=${remaining.slice(0, CHUNK_SIZE)}`);
      remaining = remaining.slice(CHUNK_SIZE);
      i++;
    }
  }

  cookieParts.push(`current_club_id=${clubId}`);
  const cookies = cookieParts.join("; ");

  const res = await fetch(`${appUrl}/api/admin/resort-players`, {
    method: "POST",
    headers: { Cookie: cookies },
    redirect: "manual",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Resort failed (${res.status}): ${text}`);
  }

  console.log(JSON.parse(text));
}

// --- Main ---

async function main() {
  console.log(`\nSupabase: ${SUPABASE_URL}\n`);

  const action = await choose("What do you want to do?", [
    "Create a new club with team and captain",
    "Add a team to an existing club",
    "Invite a captain to an existing team",
    "Resort players by LK",
  ]);

  if (action === "Create a new club with team and captain") {
    const club = await createClub();
    const team = await createTeam(club.id);
    await inviteCaptain(club.id, team.id);
  } else if (action === "Add a team to an existing club") {
    const club = await pickClub();
    const team = await createTeam(club.id);
    const addCaptain = await choose("Invite a captain for this team?", [
      "yes",
      "no",
    ]);
    if (addCaptain === "yes") {
      await inviteCaptain(club.id, team.id);
    }
  } else if (action === "Resort players by LK") {
    const club = await pickClub();
    console.log(`\nResorting players for ${club.name}...`);
    await resortPlayers(club.id);
  } else {
    const club = await pickClub();
    const team = await pickTeam(club.id);
    await inviteCaptain(club.id, team.id);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
