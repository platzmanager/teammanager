"use server";

import { getMemberForUser } from "@/lib/auth";
import { withClubContext } from "@/lib/club";
import { revalidatePath } from "next/cache";
import { EventResponse, RsvpResponse } from "@/lib/types";

export async function respondToEvent(occurrenceId: string, response: RsvpResponse, comment?: string) {
  const member = await getMemberForUser();
  if (!member) throw new Error("Kein Mitglied gefunden. Bitte zuerst registrieren.");

  return withClubContext(async (supabase) => {
    const { error } = await supabase
      .from("event_responses")
      .upsert(
        {
          event_occurrence_id: occurrenceId,
          member_id: member.id,
          response,
          comment: comment || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "event_occurrence_id,member_id" }
      );

    if (error) throw error;
    revalidatePath("/", "layout");
  });
}

export async function getOccurrenceResponses(occurrenceId: string) {
  return withClubContext(async (supabase) => {
    const { data, error } = await supabase
      .from("event_responses")
      .select("*, member:members(*)")
      .eq("event_occurrence_id", occurrenceId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as EventResponse[];
  });
}

export async function getMyResponses(occurrenceIds: string[]) {
  if (occurrenceIds.length === 0) return {};

  const member = await getMemberForUser();
  if (!member) return {};

  return withClubContext(async (supabase) => {
    const { data, error } = await supabase
      .from("event_responses")
      .select("*")
      .eq("member_id", member.id)
      .in("event_occurrence_id", occurrenceIds);

    if (error) throw error;

    const map: Record<string, EventResponse> = {};
    for (const r of data ?? []) {
      map[r.event_occurrence_id] = r as EventResponse;
    }
    return map;
  });
}
