// Rank the 12 third-place teams and pick the best 8 that advance.
//
// FIFA 2026 third-place comparison criteria (same priority as group standings):
//   1) points, 2) goal difference, 3) goals scored, 4) deterministic tiebreak
//   (team id alphabetical) standing in for fair-play / drawing of lots.
//
// The qualifying 8's group letters are what drives bracket seeding later —
// see data/assignmentTable.ts.
import type { GroupId, Standing } from './types';
import { GROUP_IDS } from './types';

export interface ThirdPlaceEntry {
  teamId: string;
  groupId: GroupId;
  points: number;
  goalDifference: number;
  goalsFor: number;
  played: number;
}

export interface ThirdPlacePossibility {
  teamId: string;
  minRank: number;
  maxRank: number;
  locked: boolean;
}

export interface IllegalThirdPlacement {
  teamId: string;
  attemptedRank: number;
}

/**
 * Extract the third-place team from each group's standings and return a
 * ThirdPlaceEntry for it. Groups whose order is not yet set (empty array)
 * produce an entry with zero stats — they will rank last by default.
 */
export function buildThirdPlaceEntries(
  groupOrder: Record<GroupId, string[]>,
  standingsByGroup: Record<GroupId, Standing[]>,
): ThirdPlaceEntry[] {
  const entries: ThirdPlaceEntry[] = [];
  for (const g of GROUP_IDS) {
    const order = groupOrder[g];
    if (!order || order.length < 3) continue;
    const thirdId = order[2];
    const standing = standingsByGroup[g]?.find((s) => s.teamId === thirdId);
    entries.push({
      teamId: thirdId,
      groupId: g,
      points: standing?.points ?? 0,
      goalDifference: standing?.goalDifference ?? 0,
      goalsFor: standing?.goalsFor ?? 0,
      played: standing?.played ?? 0,
    });
  }
  return entries;
}

/**
 * Sort ThirdPlaceEntry[] best-first by FIFA criteria.
 * Returns a new array; does not mutate the input.
 */
export function rankThirdPlaceEntries(entries: ThirdPlaceEntry[]): ThirdPlaceEntry[] {
  return [...entries].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    // Deterministic stand-in for fair-play / drawing of lots.
    return a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;
  });
}

/** The 8 advancing third-place team ids, in ranked order (best first). */
export function qualifyingThirdPlace(ranked: ThirdPlaceEntry[]): string[] {
  return ranked.slice(0, 8).map((e) => e.teamId);
}

/** The group ids of the 8 qualifying third-place teams (feeds bracket seeding). */
export function qualifyingThirdPlaceGroups(ranked: ThirdPlaceEntry[]): GroupId[] {
  return ranked.slice(0, 8).map((e) => e.groupId);
}

/**
 * Returns true if team A can possibly finish above team B given remaining matches.
 *
 * Each team plays exactly 3 group matches (remaining = 3 - played).
 * - Definitive NO: A's best possible points (current + 3×remaining) < B's current points.
 * - Both complete (played === 3): stats are frozen — apply exact FIFA tiebreaker.
 * - Otherwise: points ranges overlap and GD/goals are unbounded → either order possible.
 */
function canRankAbove(a: ThirdPlaceEntry, b: ThirdPlaceEntry): boolean {
  const aMax = a.points + 3 * (3 - a.played);
  if (aMax < b.points) return false;

  if (a.played === 3 && b.played === 3) {
    if (a.points !== b.points) return a.points > b.points;
    if (a.goalDifference !== b.goalDifference) return a.goalDifference > b.goalDifference;
    if (a.goalsFor !== b.goalsFor) return a.goalsFor > b.goalsFor;
    return a.teamId < b.teamId;
  }

  return true;
}

/**
 * For each third-place team, compute the tightest rank window [minRank, maxRank]
 * given the current match results and remaining fixtures.
 */
export function computeThirdPlacePossibilities(
  entries: ThirdPlaceEntry[],
): ThirdPlacePossibility[] {
  const n = entries.length;
  return entries.map((team) => {
    const mustAbove = entries.filter(
      (other) => other.teamId !== team.teamId && !canRankAbove(team, other),
    ).length;
    const mustBelow = entries.filter(
      (other) => other.teamId !== team.teamId && !canRankAbove(other, team),
    ).length;
    const minRank = mustAbove + 1;
    const maxRank = n - mustBelow;
    return { teamId: team.teamId, minRank, maxRank, locked: minRank === maxRank };
  });
}

/**
 * Check whether a proposed third-place ordering violates any constraint.
 * Returns the first team placed outside its reachable rank window, or null if valid.
 */
export function firstIllegalThirdPlacement(
  orderedIds: string[],
  possibilities: ThirdPlacePossibility[],
): IllegalThirdPlacement | null {
  const byId = Object.fromEntries(possibilities.map((p) => [p.teamId, p]));
  for (let i = 0; i < orderedIds.length; i++) {
    const p = byId[orderedIds[i]];
    if (!p) continue;
    const rank = i + 1;
    if (rank < p.minRank || rank > p.maxRank) {
      return { teamId: orderedIds[i], attemptedRank: rank };
    }
  }
  return null;
}
