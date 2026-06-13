// Derive the full bracket from group orders, third-place qualifiers, and user picks.
//
// Derive-on-read: the store holds only bracketPicks (matchId → winnerId). The
// full BracketSlot tree is computed fresh each time so upstream changes (group
// order edits, third-place rank changes) automatically invalidate stale picks.
import { WINNER_DESTINATION } from '../data/bracketTemplate';
import { seedRound32 } from './bracketSeeding';
import type { BracketSlot, GroupId } from './types';

/**
 * Derive the complete 31-match bracket.
 *
 * 1. Seeds R32 from groupOrder + qualifying third-place groups.
 * 2. Walks matches in ascending matchId order (feeders always before recipients).
 * 3. For each match: applies a valid user pick, then propagates the winner into
 *    the next round's participant slot.
 *
 * A pick is "valid" only when it matches one of the match's current participants.
 * Stale picks (from a changed upstream) are silently ignored.
 */
export function computeBracket(
  groupOrder: Record<GroupId, string[]>,
  qualifyingThirdGroups: GroupId[],
  picks: Record<number, string>,
): Record<number, BracketSlot> {
  const bracket = seedRound32(groupOrder, qualifyingThirdGroups);

  const matchIds = Object.keys(bracket).map(Number).sort((a, b) => a - b);

  for (const matchId of matchIds) {
    const slot = bracket[matchId];

    if (!slot.locked) {
      const pick = picks[matchId];
      if (pick && (pick === slot.homeId || pick === slot.awayId)) {
        slot.winnerId = pick;
      }
    }

    if (slot.winnerId) {
      const dest = WINNER_DESTINATION[matchId];
      if (dest) {
        const next = bracket[dest.matchId];
        if (dest.side === 'home') next.homeId = slot.winnerId;
        else next.awayId = slot.winnerId;
      }
    }
  }

  return bracket;
}

/** True once all 31 matches through the final have a decided winner. */
export function isBracketComplete(bracket: Record<number, BracketSlot>): boolean {
  const slots = Object.values(bracket);
  return slots.length === 31 && slots.every((s) => Boolean(s.winnerId));
}

/** Returns the champion team id, or undefined if the final hasn't been decided. */
export function getChampion(bracket: Record<number, BracketSlot>): string | undefined {
  return bracket[104]?.winnerId;
}
