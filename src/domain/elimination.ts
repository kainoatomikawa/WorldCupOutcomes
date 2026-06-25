// The constraint engine: which group placements are still mathematically
// reachable for each team, given current results and remaining fixtures.
//
// A group has 4 teams and 6 matches, so at most 6 remain. We brute-force every
// combination of remaining results (3^n outcomes, n ≤ 6 → ≤ 729) and, for each,
// compute the range of positions each team could finish in.
//
// Reachability is computed at the POINTS level. Within a scenario, teams level
// on points are treated optimistically/pessimistically for the team in question
// (it could finish anywhere in the tied block), since goal-difference and
// goals-scored tiebreakers are controllable by choosing remaining scorelines.
// This can very slightly over-approximate in rare fixed-goal cases, which errs
// toward ALLOWING a borderline placement rather than wrongly forbidding a legal
// one — the safer behavior for the UI.
import type { GroupId, Match, PlacementPossibility, Standing, Team } from './types';

/** Head-to-head points among a subset of teams, from the supplied match list. */
function h2hPointsAmong(teamIds: string[], matches: Match[]): Record<string, number> {
  const inSet = new Set(teamIds);
  const pts: Record<string, number> = Object.fromEntries(teamIds.map((id) => [id, 0]));
  for (const m of matches) {
    if (!m.played || m.homeGoals == null || m.awayGoals == null) continue;
    if (!inSet.has(m.homeId) || !inSet.has(m.awayId)) continue;
    if (m.homeGoals > m.awayGoals) pts[m.homeId] += 3;
    else if (m.homeGoals < m.awayGoals) pts[m.awayId] += 3;
    else { pts[m.homeId] += 1; pts[m.awayId] += 1; }
  }
  return pts;
}

/**
 * For each team in a group, determine whether it can still finish 1st / 2nd / 3rd.
 * The UI uses this to disable illegal drag-and-drop placements.
 */
export function computePlacementPossibilities(
  groupId: GroupId,
  teams: Team[],
  matches: Match[],
  standings: Standing[],
): PlacementPossibility[] {
  const groupTeamIds = teams
    .filter((t) => t.groupId === groupId)
    .map((t) => t.id);

  const basePoints: Record<string, number> = {};
  for (const id of groupTeamIds) basePoints[id] = 0;
  for (const s of standings) {
    if (s.teamId in basePoints) basePoints[s.teamId] = s.points;
  }

  const groupMatches = matches.filter(
    (m) =>
      m.groupId === groupId &&
      m.homeId in basePoints &&
      m.awayId in basePoints,
  );
  const remaining = groupMatches.filter((m) => !m.played);
  // A group is only "complete" if it has matches AND they are all played. With
  // no matches scheduled yet, every position is still reachable (not complete).
  const complete = groupMatches.length > 0 && remaining.length === 0;

  const reachable: Record<string, Set<number>> = {};
  for (const id of groupTeamIds) reachable[id] = new Set<number>();

  if (complete) {
    // Positions are fixed by the current standings.
    for (const s of standings) {
      if (s.teamId in reachable) reachable[s.teamId].add(s.position);
    }
  } else {
    const n = remaining.length;
    const combos = 3 ** n;
    const playedMatches = matches.filter((m) => m.played);
    for (let scenario = 0; scenario < combos; scenario++) {
      const points = { ...basePoints };
      const outcomes: number[] = new Array(n);
      let code = scenario;
      for (let k = 0; k < n; k++) {
        outcomes[k] = code % 3;
        code = Math.floor(code / 3);
        const m = remaining[k];
        if (outcomes[k] === 0) {
          points[m.homeId] += 3; // home win
        } else if (outcomes[k] === 1) {
          points[m.homeId] += 1; // draw
          points[m.awayId] += 1;
        } else {
          points[m.awayId] += 3; // away win
        }
      }

      // Synthetic matches for this scenario's remaining fixtures — used only for
      // head-to-head points (scorelines don't matter, just win/draw/loss).
      const scenarioMatches: Match[] = remaining.map((m, k) => ({
        ...m,
        played: true,
        homeGoals: outcomes[k] === 0 ? 1 : 0,
        awayGoals: outcomes[k] === 2 ? 1 : 0,
      }));
      const allMatchesForH2H = [...playedMatches, ...scenarioMatches];

      // Sort teams by scenario points, find tied blocks, then apply h2h within
      // each block to narrow reachable positions before falling back to "any
      // position in the sub-block" for teams still tied on h2h points.
      const sortedIds = [...groupTeamIds].sort((a, b) => points[b] - points[a]);
      let rankPos = 1;
      let i = 0;
      while (i < sortedIds.length) {
        let j = i + 1;
        while (j < sortedIds.length && points[sortedIds[j]] === points[sortedIds[i]]) j++;

        const tiedBlock = sortedIds.slice(i, j);
        if (tiedBlock.length === 1) {
          reachable[tiedBlock[0]].add(rankPos);
        } else {
          const h2h = h2hPointsAmong(tiedBlock, allMatchesForH2H);
          const byH2H = [...tiedBlock].sort((a, b) => h2h[b] - h2h[a]);
          let subRank = rankPos;
          let m2 = 0;
          while (m2 < byH2H.length) {
            let l = m2 + 1;
            while (l < byH2H.length && h2h[byH2H[l]] === h2h[byH2H[m2]]) l++;
            const subBlock = byH2H.slice(m2, l);
            for (const id of subBlock) {
              for (let rank = subRank; rank < subRank + subBlock.length; rank++) {
                reachable[id].add(rank);
              }
            }
            subRank += subBlock.length;
            m2 = l;
          }
        }
        rankPos += tiedBlock.length;
        i = j;
      }
    }
  }

  return groupTeamIds.map((id) => ({
    teamId: id,
    canFinish1st: reachable[id].has(1),
    canFinish2nd: reachable[id].has(2),
    canFinish3rd: reachable[id].has(3),
    canFinish4th: reachable[id].has(4),
    locked: complete,
  }));
}

/** True once every group match has been played and standings are fixed. */
export function isGroupComplete(groupId: GroupId, matches: Match[]): boolean {
  const groupMatches = matches.filter((m) => m.groupId === groupId);
  return groupMatches.length > 0 && groupMatches.every((m) => m.played);
}
