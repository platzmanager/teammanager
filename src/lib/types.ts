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
  invite_token: string | null;
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
  player_uuid?: string | null;
  teams?: Team[];
  created_at: string;
}

// ─── Members, Events & RSVP ───

export type EventType = "match" | "training" | "social" | "custom";
export type RecurrenceType = "none" | "weekly" | "biweekly" | "monthly";
export type RsvpResponse = "yes" | "no" | "maybe";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  match: "Spieltag",
  training: "Training",
  social: "Gesellig",
  custom: "Sonstiges",
};

export const RECURRENCE_TYPE_LABELS: Record<RecurrenceType, string> = {
  none: "Einmalig",
  weekly: "Wöchentlich",
  biweekly: "Alle 2 Wochen",
  monthly: "Monatlich",
};

export const RSVP_LABELS: Record<RsvpResponse, string> = {
  yes: "Zusage",
  no: "Absage",
  maybe: "Vielleicht",
};

export interface Member {
  id: string;
  club_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  player_uuid: string | null;
  created_at: string;
}

export interface ClubEvent {
  id: string;
  club_id: string;
  team_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  event_type: EventType;
  recurrence_type: RecurrenceType;
  recurrence_day_of_week: number | null;
  recurrence_end_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EventOccurrence {
  id: string;
  event_id: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  cancelled: boolean;
  notes: string | null;
  match_id: string | null;
  created_at: string;
  // Joined fields
  event?: ClubEvent;
  match?: Match;
  responses?: EventResponse[];
}

export interface EventResponse {
  id: string;
  event_occurrence_id: string;
  member_id: string;
  response: RsvpResponse;
  comment: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  member?: Member;
}
