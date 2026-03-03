export type Gender = "male" | "female";

export const GENDER_LABELS: Record<Gender, string> = {
  female: "Damen",
  male: "Herren",
};
export type AgeClass = "all" | "30" | "40" | "50" | "60";
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
