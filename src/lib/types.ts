export type Gender = "male" | "female";

export const GENDER_LABELS: Record<Gender, string> = {
  female: "Damen",
  male: "Herren",
};
export type AgeClass = "all" | "30" | "40" | "50" | "60" | "u9" | "u10" | "u12" | "u15" | "u18";

export interface AgeClassInfo {
  label: string;
  isYouth: boolean;
  isMixed: boolean;
  maxAge?: number;
  minAge?: number;
  youthGenderLabels?: { male: string; female: string };
}

export const AGE_CLASS_CONFIG: Record<AgeClass, AgeClassInfo> = {
  all: { label: "Alle", isYouth: false, isMixed: false },
  "30": { label: "30", isYouth: false, isMixed: false, minAge: 30 },
  "40": { label: "40", isYouth: false, isMixed: false, minAge: 40 },
  "50": { label: "50", isYouth: false, isMixed: false, minAge: 50 },
  "60": { label: "60", isYouth: false, isMixed: false, minAge: 60 },
  u9: { label: "Kleinfeld U9", isYouth: true, isMixed: true, maxAge: 9 },
  u10: { label: "Midcourt U10", isYouth: true, isMixed: true, maxAge: 10 },
  u12: { label: "Bambini U12", isYouth: true, isMixed: true, maxAge: 12 },
  u15: { label: "U15", isYouth: true, isMixed: false, maxAge: 15, youthGenderLabels: { male: "Knaben", female: "Mädchen" } },
  u18: { label: "U18", isYouth: true, isMixed: false, maxAge: 18, youthGenderLabels: { male: "Junioren", female: "Juniorinnen" } },
};
export type UserRole = "admin" | "captain" | "player";

export interface Club {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Player {
  uuid: string;
  club_id: string;
  license: string | null;
  last_name: string;
  first_name: string;
  birth_date: string; // ISO date string
  skill_level: number | null;
  gender: Gender;
  sort_position: number;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface PlayerRegistration {
  player_uuid: string;
  age_class: AgeClass;
  gender: Gender;
}

export interface EventLog {
  id: number;
  event_type: "reorder" | "register" | "unregister" | "create" | "update" | "delete" | "csv_import";
  gender: Gender;
  age_class: string | null;
  player_uuid: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  club_id: string;
  name: string;
  gender: Gender;
  age_class: AgeClass;
  slug: string;
  team_size: number;
  rank: number;
  league_class: string | null;
  league: string | null;
  league_group: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  team_id: string;
  club_id: string;
  match_date: string;
  match_time: string | null;
  is_home: boolean;
  home_team: string;
  away_team: string;
  match_number: string | null;
  location: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  team_id: string | null;
  team?: Team | null;
  player_uuid?: string | null;
  teams?: Team[];
  created_at: string;
}
