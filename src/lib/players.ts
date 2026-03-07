import { Player, AgeClass, AGE_CLASS_CONFIG } from "./types";

export function getAge(birthDate: string): number {
  const birthYear = new Date(birthDate).getFullYear();
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
}

export function filterByAgeClass(players: Player[], ageClass: AgeClass): Player[] {
  if (ageClass === "all") return players;
  const config = AGE_CLASS_CONFIG[ageClass];
  if (config.isYouth && config.maxAge != null) {
    return players.filter((p) => getAge(p.birth_date) <= config.maxAge!);
  }
  if (config.minAge != null) {
    return players.filter((p) => getAge(p.birth_date) >= config.minAge!);
  }
  return players;
}

export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const aManual = a.skill_level == null || a.skill_level > 20;
    const bManual = b.skill_level == null || b.skill_level > 20;

    // Auto-sorted (skill_level ≤ 20) come before manual (skill_level > 20 or null)
    if (!aManual && bManual) return -1;
    if (aManual && !bManual) return 1;

    // Both manual: sort by sort_position
    if (aManual && bManual) return a.sort_position - b.sort_position;

    // Both auto-sorted: sort by skill_level, then by sort_position for same skill_level
    if (a.skill_level !== b.skill_level) return a.skill_level! - b.skill_level!;
    return a.sort_position - b.sort_position;
  });
}

export function isManuallySortable(player: Player, allPlayers: Player[]): boolean {
  if (player.skill_level == null || player.skill_level > 20) return true;
  // Same skill_level group with more than one player
  return allPlayers.filter((p) => p.skill_level === player.skill_level).length > 1;
}
