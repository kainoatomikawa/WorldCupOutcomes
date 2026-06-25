import { describe, it, expect } from 'vitest';
import {
  buildThirdPlaceEntries,
  rankThirdPlaceEntries,
  qualifyingThirdPlace,
  qualifyingThirdPlaceGroups,
  computeThirdPlacePossibilities,
  firstIllegalThirdPlacement,
  type ThirdPlaceEntry,
} from './thirdPlace';
import type { GroupId, Standing } from './types';
import { GROUP_IDS } from './types';

// Build a minimal groupOrder with a specific team at index 2 for each group.
function makeGroupOrder(thirdTeamByGroup: Partial<Record<GroupId, string>>): Record<GroupId, string[]> {
  return Object.fromEntries(
    GROUP_IDS.map((g) => {
      const third = thirdTeamByGroup[g] ?? `${g}-default-3rd`;
      return [g, [`${g}-1st`, `${g}-2nd`, third, `${g}-4th`]];
    }),
  ) as Record<GroupId, string[]>;
}

function makeStanding(teamId: string, _groupId: GroupId, pts: number, gd: number, gf: number): Standing {
  return {
    teamId,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: gf,
    goalsAgainst: gf - gd,
    goalDifference: gd,
    points: pts,
    position: 3,
  };
}

describe('buildThirdPlaceEntries', () => {
  it('extracts one entry per group at index 2 of groupOrder', () => {
    const groupOrder = makeGroupOrder({ A: 'arg', B: 'bra' });
    const standings = Object.fromEntries(
      GROUP_IDS.map((g) => [g, [] as Standing[]]),
    ) as Record<GroupId, Standing[]>;
    standings.A = [makeStanding('A-1st', 'A', 9, 5, 6), makeStanding('A-2nd', 'A', 6, 2, 4), makeStanding('arg', 'A', 3, -1, 2)];

    const entries = buildThirdPlaceEntries(groupOrder, standings);
    expect(entries).toHaveLength(12);
    const argEntry = entries.find((e) => e.teamId === 'arg');
    expect(argEntry).toMatchObject({ teamId: 'arg', groupId: 'A', points: 3, goalDifference: -1, goalsFor: 2 });
  });

  it('uses zero stats for groups with no standings yet', () => {
    const groupOrder = makeGroupOrder({});
    const standings = Object.fromEntries(GROUP_IDS.map((g) => [g, [] as Standing[]])) as Record<GroupId, Standing[]>;
    const entries = buildThirdPlaceEntries(groupOrder, standings);
    expect(entries.every((e) => e.points === 0)).toBe(true);
  });
});

describe('rankThirdPlaceEntries', () => {
  it('ranks by points descending', () => {
    const entries: ThirdPlaceEntry[] = [
      { teamId: 'low', groupId: 'A', points: 2, goalDifference: 0, goalsFor: 0, played: 3 },
      { teamId: 'high', groupId: 'B', points: 7, goalDifference: 0, goalsFor: 0, played: 3 },
      { teamId: 'mid', groupId: 'C', points: 4, goalDifference: 0, goalsFor: 0, played: 3 },
    ];
    const ranked = rankThirdPlaceEntries(entries);
    expect(ranked.map((e) => e.teamId)).toEqual(['high', 'mid', 'low']);
  });

  it('breaks points ties by goal difference', () => {
    const entries: ThirdPlaceEntry[] = [
      { teamId: 'a', groupId: 'A', points: 4, goalDifference: -1, goalsFor: 2, played: 3 },
      { teamId: 'b', groupId: 'B', points: 4, goalDifference: 3, goalsFor: 4, played: 3 },
    ];
    const ranked = rankThirdPlaceEntries(entries);
    expect(ranked[0].teamId).toBe('b');
  });

  it('breaks GD ties by goals scored', () => {
    const entries: ThirdPlaceEntry[] = [
      { teamId: 'a', groupId: 'A', points: 4, goalDifference: 1, goalsFor: 2, played: 3 },
      { teamId: 'b', groupId: 'B', points: 4, goalDifference: 1, goalsFor: 5, played: 3 },
    ];
    const ranked = rankThirdPlaceEntries(entries);
    expect(ranked[0].teamId).toBe('b');
  });

  it('does not mutate the input array', () => {
    const entries: ThirdPlaceEntry[] = [
      { teamId: 'b', groupId: 'B', points: 2, goalDifference: 0, goalsFor: 0, played: 3 },
      { teamId: 'a', groupId: 'A', points: 7, goalDifference: 0, goalsFor: 0, played: 3 },
    ];
    const original = [...entries];
    rankThirdPlaceEntries(entries);
    expect(entries).toEqual(original);
  });
});

describe('qualifyingThirdPlace + qualifyingThirdPlaceGroups', () => {
  it('returns the top 8 ids and their group letters', () => {
    const ranked = GROUP_IDS.map((g, i) => ({
      teamId: `team-${g}`,
      groupId: g,
      points: 12 - i,
      goalDifference: 0,
      goalsFor: 0,
      played: 3,
    }));
    expect(qualifyingThirdPlace(ranked)).toHaveLength(8);
    expect(qualifyingThirdPlace(ranked)[0]).toBe('team-A');
    expect(qualifyingThirdPlaceGroups(ranked)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  });
});

const e = (teamId: string, points: number, gd: number, gf: number, played: number): ThirdPlaceEntry => ({
  teamId, groupId: 'A', points, goalDifference: gd, goalsFor: gf, played,
});

describe('computeThirdPlacePossibilities', () => {
  it('locks a complete team definitively above a complete team with fewer points', () => {
    const entries = [e('high', 4, 2, 4, 3), e('low', 3, 1, 3, 3)];
    const [high, low] = computeThirdPlacePossibilities(entries);
    expect(high.minRank).toBe(1);
    expect(high.maxRank).toBe(1);
    expect(high.locked).toBe(true);
    expect(low.minRank).toBe(2);
    expect(low.locked).toBe(true);
  });

  it('blocks a team from ranking above one whose minimum points exceed its maximum', () => {
    // A: 4pts, all played (max = 4). B: 0pts, 1 remaining (max = 3). A must rank above B.
    const entries = [e('A', 4, 0, 4, 3), e('B', 0, 0, 0, 2)];
    const [a, b] = computeThirdPlacePossibilities(entries);
    expect(a.minRank).toBe(1);
    expect(b.maxRank).toBe(2);
    expect(b.minRank).toBe(2);
  });

  it('allows either order when an incomplete team could still surpass the other', () => {
    // A: 3pts complete. B: 0pts but 1 remaining (max = 3, could tie or exceed on GD).
    const entries = [e('A', 3, 0, 3, 3), e('B', 0, 0, 0, 2)];
    const [a, b] = computeThirdPlacePossibilities(entries);
    expect(a.minRank).toBe(1);
    expect(a.maxRank).toBe(2);
    expect(b.minRank).toBe(1);
    expect(b.maxRank).toBe(2);
  });
});

describe('firstIllegalThirdPlacement', () => {
  it('returns null for a valid ordering', () => {
    const entries = [e('high', 4, 0, 4, 3), e('low', 1, 0, 1, 3)];
    const possibilities = computeThirdPlacePossibilities(entries);
    expect(firstIllegalThirdPlacement(['high', 'low'], possibilities)).toBeNull();
  });

  it('flags a team placed above a team it cannot beat', () => {
    const entries = [e('high', 4, 0, 4, 3), e('low', 1, 0, 1, 3)];
    const possibilities = computeThirdPlacePossibilities(entries);
    const result = firstIllegalThirdPlacement(['low', 'high'], possibilities);
    expect(result).not.toBeNull();
    expect(result?.teamId).toBe('low');
    expect(result?.attemptedRank).toBe(1);
  });
});
