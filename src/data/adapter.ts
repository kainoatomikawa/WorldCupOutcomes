// Map the external football API's response shape into our domain types. Keeping
// this in one place means the rest of the app never depends on the upstream
// schema — only on our own `Match`/`Team` types.
import type { Match } from '../domain/types';

/**
 * Convert the upstream API payload into domain Matches.
 *
 * TODO: implement once a data provider is chosen (football-data.org / API-Football).
 */
export function toMatches(_raw: unknown): Match[] {
  throw new Error('toMatches: not implemented');
}
