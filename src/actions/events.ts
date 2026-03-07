"use server";

import { requireRole } from "@/lib/auth";
import { withClubContext } from "@/lib/club";
import { revalidatePath } from "next/cache";
import { ClubEvent, EventOccurrence, Match } from "@/lib/types";

export async function createEvent(formData: FormData) {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    const teamId = formData.get("team_id") as string | null;

    // Only admin or captain of the team can create events
    if (profile.role !== "admin") {
      if (!teamId || !profile.teams?.some((t) => t.id === teamId)) {
        throw new Error("Keine Berechtigung");
      }
    }

    const eventType = formData.get("event_type") as string;
    const recurrenceType = (formData.get("recurrence_type") as string) || "none";
    const startDate = formData.get("start_date") as string;
    const startTime = (formData.get("start_time") as string) || null;
    const endTime = (formData.get("end_time") as string) || null;
    const recurrenceEndDate = (formData.get("recurrence_end_date") as string) || null;

    const dayOfWeek = startDate ? new Date(startDate + "T00:00:00").getDay() : null;

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        club_id: clubId,
        team_id: teamId || null,
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        location: (formData.get("location") as string) || null,
        event_type: eventType,
        recurrence_type: recurrenceType,
        recurrence_day_of_week: recurrenceType !== "none" ? dayOfWeek : null,
        recurrence_end_date: recurrenceEndDate || null,
        created_by: profile.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Generate occurrences
    await generateOccurrences(supabase, event.id, startDate, startTime, endTime, recurrenceType, recurrenceEndDate);

    revalidatePath("/", "layout");
    return event as ClubEvent;
  });
}

export async function updateEvent(id: string, formData: FormData) {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    // Verify ownership
    const { data: existing } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .eq("club_id", clubId)
      .single();

    if (!existing) throw new Error("Termin nicht gefunden");

    if (profile.role !== "admin") {
      if (!existing.team_id || !profile.teams?.some((t) => t.id === existing.team_id)) {
        throw new Error("Keine Berechtigung");
      }
    }

    const { error } = await supabase
      .from("events")
      .update({
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || null,
        location: (formData.get("location") as string) || null,
        event_type: formData.get("event_type") as string,
      })
      .eq("id", id)
      .eq("club_id", clubId);

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

export async function deleteEvent(id: string) {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    const { data: existing } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .eq("club_id", clubId)
      .single();

    if (!existing) throw new Error("Termin nicht gefunden");

    if (profile.role !== "admin") {
      if (!existing.team_id || !profile.teams?.some((t) => t.id === existing.team_id)) {
        throw new Error("Keine Berechtigung");
      }
    }

    const { error } = await supabase.from("events").delete().eq("id", id).eq("club_id", clubId);
    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

export async function getTeamEvents(teamId: string) {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("event_occurrences")
      .select("*, event:events!inner(*), match:matches(*)")
      .eq("event.club_id", clubId)
      .eq("event.team_id", teamId)
      .gte("start_date", new Date().toISOString().split("T")[0])
      .order("start_date")
      .order("start_time");

    if (error) throw error;
    return (data ?? []) as EventOccurrence[];
  });
}

export async function getClubEvents() {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("event_occurrences")
      .select("*, event:events!inner(*)")
      .eq("event.club_id", clubId)
      .is("event.team_id", null)
      .gte("start_date", new Date().toISOString().split("T")[0])
      .order("start_date")
      .order("start_time");

    if (error) throw error;
    return (data ?? []) as EventOccurrence[];
  });
}

export async function getMemberEvents(memberTeamIds: string[]) {
  return withClubContext(async (supabase, clubId) => {
    const today = new Date().toISOString().split("T")[0];

    // Club-wide events (team_id is null)
    const { data: clubEvents, error: clubError } = await supabase
      .from("event_occurrences")
      .select("*, event:events!inner(*), match:matches(*)")
      .eq("event.club_id", clubId)
      .is("event.team_id", null)
      .gte("start_date", today)
      .order("start_date")
      .order("start_time");

    if (clubError) throw clubError;

    // Team events for the member's teams
    let teamEvents: EventOccurrence[] = [];
    if (memberTeamIds.length > 0) {
      const { data, error } = await supabase
        .from("event_occurrences")
        .select("*, event:events!inner(*), match:matches(*)")
        .eq("event.club_id", clubId)
        .in("event.team_id", memberTeamIds)
        .gte("start_date", today)
        .order("start_date")
        .order("start_time");

      if (error) throw error;
      teamEvents = (data ?? []) as EventOccurrence[];
    }

    const all = [...(clubEvents ?? []) as EventOccurrence[], ...teamEvents];
    all.sort((a, b) => {
      const dateComp = a.start_date.localeCompare(b.start_date);
      if (dateComp !== 0) return dateComp;
      return (a.start_time ?? "").localeCompare(b.start_time ?? "");
    });

    return all;
  });
}

export async function cancelOccurrence(id: string) {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    const { data: occ } = await supabase
      .from("event_occurrences")
      .select("*, event:events!inner(*)")
      .eq("id", id)
      .single();

    if (!occ) throw new Error("Termin nicht gefunden");
    if ((occ.event as ClubEvent).club_id !== clubId) throw new Error("Keine Berechtigung");

    if (profile.role !== "admin") {
      const teamId = (occ.event as ClubEvent).team_id;
      if (!teamId || !profile.teams?.some((t) => t.id === teamId)) {
        throw new Error("Keine Berechtigung");
      }
    }

    const { error } = await supabase
      .from("event_occurrences")
      .update({ cancelled: true })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

export async function uncancelOccurrence(id: string) {
  const profile = await requireRole();
  return withClubContext(async (supabase, clubId) => {
    const { data: occ } = await supabase
      .from("event_occurrences")
      .select("*, event:events!inner(*)")
      .eq("id", id)
      .single();

    if (!occ) throw new Error("Termin nicht gefunden");
    if ((occ.event as ClubEvent).club_id !== clubId) throw new Error("Keine Berechtigung");

    if (profile.role !== "admin") {
      const teamId = (occ.event as ClubEvent).team_id;
      if (!teamId || !profile.teams?.some((t) => t.id === teamId)) {
        throw new Error("Keine Berechtigung");
      }
    }

    const { error } = await supabase
      .from("event_occurrences")
      .update({ cancelled: false })
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

async function generateOccurrences(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  eventId: string,
  startDate: string,
  startTime: string | null,
  endTime: string | null,
  recurrenceType: string,
  recurrenceEndDate: string | null,
) {
  const occurrences: { event_id: string; start_date: string; start_time: string | null; end_time: string | null }[] = [];

  const maxDate = recurrenceEndDate
    ? new Date(recurrenceEndDate + "T00:00:00")
    : new Date(new Date(startDate + "T00:00:00").getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // ~6 months

  const current = new Date(startDate + "T00:00:00");

  while (current <= maxDate) {
    occurrences.push({
      event_id: eventId,
      start_date: current.toISOString().split("T")[0],
      start_time: startTime,
      end_time: endTime,
    });

    if (recurrenceType === "none") break;
    if (recurrenceType === "weekly") current.setDate(current.getDate() + 7);
    else if (recurrenceType === "biweekly") current.setDate(current.getDate() + 14);
    else if (recurrenceType === "monthly") current.setMonth(current.getMonth() + 1);
  }

  if (occurrences.length > 0) {
    const { error } = await supabase.from("event_occurrences").insert(occurrences);
    if (error) throw error;
  }
}

export async function createMatchOccurrences(teamId: string, matches: Match[]) {
  return withClubContext(async (supabase, clubId) => {
    if (matches.length === 0) return;

    // Find or create the "Spieltage" event for this team
    let { data: event } = await supabase
      .from("events")
      .select("id")
      .eq("club_id", clubId)
      .eq("team_id", teamId)
      .eq("event_type", "match")
      .maybeSingle();

    if (!event) {
      const { data: newEvent, error } = await supabase
        .from("events")
        .insert({
          club_id: clubId,
          team_id: teamId,
          title: "Spieltage",
          event_type: "match",
          recurrence_type: "none",
        })
        .select()
        .single();

      if (error) throw error;
      event = newEvent;
    }

    // Get existing occurrences for this event
    const { data: existing } = await supabase
      .from("event_occurrences")
      .select("id, match_id")
      .eq("event_id", event!.id);

    const existingByMatchId = new Map((existing ?? []).map((e) => [e.match_id, e.id]));
    const newMatchIds = new Set(matches.map((m) => m.id));

    // Delete occurrences for matches that no longer exist
    const toDelete = (existing ?? []).filter((e) => !newMatchIds.has(e.match_id)).map((e) => e.id);
    if (toDelete.length > 0) {
      await supabase.from("event_occurrences").delete().in("id", toDelete);
    }

    // Insert only new matches (ones without existing occurrences)
    const toInsert = matches
      .filter((m) => !existingByMatchId.has(m.id))
      .map((m) => ({
        event_id: event!.id,
        start_date: m.match_date,
        start_time: m.match_time,
        match_id: m.id,
      }));

    if (toInsert.length > 0) {
      const { error } = await supabase.from("event_occurrences").insert(toInsert);
      if (error) throw error;
    }

    // Update dates/times for existing occurrences
    for (const m of matches) {
      const existingId = existingByMatchId.get(m.id);
      if (existingId) {
        await supabase
          .from("event_occurrences")
          .update({ start_date: m.match_date, start_time: m.match_time })
          .eq("id", existingId);
      }
    }
  });
}

export async function getAllTeamEvents(teamId: string) {
  return withClubContext(async (supabase, clubId) => {
    const { data, error } = await supabase
      .from("event_occurrences")
      .select("*, event:events!inner(*), match:matches(*)")
      .eq("event.club_id", clubId)
      .eq("event.team_id", teamId)
      .order("start_date")
      .order("start_time");

    if (error) throw error;
    return (data ?? []) as EventOccurrence[];
  });
}
