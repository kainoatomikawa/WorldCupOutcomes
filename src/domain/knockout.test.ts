import { describe, it, expect } from 'vitest';
import { computeBracket, isBracketComplete, getChampion } from './knockout';
import { GROUP_IDS } from './types';
import type { GroupId } from './types';

const ORDER: Record<GroupId, string[]> = Object.fromEntries(
  GROUP_IDS.map((g) => [g, [`w-${g}`, `ru-${g}`, `3-${g}`, `4-${g}`]]),
) as Record<GroupId, string[]>;

const QUAL_GROUPS: GroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

describe('computeBracket', () => {
  it('with no picks: R32 participants set, R16+ TBD, no winners', () => {
    const b = computeBracket(ORDER, QUAL_GROUPS, {});
    // R32 has known participants
    expect(b[73].homeId).toBe('ru-A');
    expect(b[73].awayId).toBe('ru-B');
    // No winner without a pick
    expect(b[73].winnerId).toBeUndefined();
    // R16 still TBD
    expect(b[89].homeId).toBeUndefined();
    expect(b[89].awayId).toBeUndefined();
  });

  it('a valid pick sets winnerId and propagates to the next round', () => {
    const b = computeBracket(ORDER, QUAL_GROUPS, { 73: 'ru-A' });
    expect(b[73].winnerId).toBe('ru-A');
    // Match 90: W73 is home, so homeId should now be 'ru-A'
    expect(b[90].homeId).toBe('ru-A');
  });

  it('an invalid pick (team not in the match) is silently ignored', () => {
    const b = computeBracket(ORDER, QUAL_GROUPS, { 73: 'w-Z' });
    expect(b[73].winnerId).toBeUndefined();
  });

  it('propagation chains through multiple rounds', () => {
    // Pick winners for matches 73, 75 → they feed R16 match 90 → pick that → QF 97
    const picks: Record<number, string> = {
      73: 'ru-A',
      75: 'w-F',
      90: 'ru-A', // will be valid since 73's winner propagated
    };
    const b = computeBracket(ORDER, QUAL_GROUPS, picks);
    expect(b[90].homeId).toBe('ru-A');
    expect(b[90].awayId).toBe('w-F');
    expect(b[90].winnerId).toBe('ru-A');
    // match 97 = W89/W90, so winner of 90 feeds as awayId
    expect(b[97].awayId).toBe('ru-A');
  });

  it('changing an upstream team invalidates a stale downstream pick', () => {
    // First: pick 'ru-A' in match 73, propagates to 90 home
    // Then change the groupOrder so match 73 home is now 'ru-X' (a different team)
    const changedOrder = {
      ...ORDER,
      A: ['w-A', 'ru-X', '3-A', '4-A'], // runner-up of group A changed
    };
    const picks = { 73: 'ru-A', 90: 'ru-A' };
    const b = computeBracket(changedOrder, QUAL_GROUPS, picks);
    // Match 73 now has 'ru-X' as home, not 'ru-A', so pick is stale
    expect(b[73].homeId).toBe('ru-X');
    expect(b[73].winnerId).toBeUndefined(); // pick ignored
    // Match 90 home is undefined (no winner propagated from 73)
    expect(b[90].homeId).toBeUndefined();
  });

  it('isBracketComplete is false with no picks', () => {
    const b = computeBracket(ORDER, QUAL_GROUPS, {});
    expect(isBracketComplete(b)).toBe(false);
  });

  it('getChampion returns undefined when final not decided', () => {
    const b = computeBracket(ORDER, QUAL_GROUPS, {});
    expect(getChampion(b)).toBeUndefined();
  });
});
