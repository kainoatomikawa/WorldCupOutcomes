// Knockout bracket: R32 → R16 → QF → SF → Final.
// Column-per-round layout. Click a team to pick the winner; click again to undo.
// The bracket re-seeds automatically when group orders or third-place rankings change.
import { getChampion } from '../../domain/knockout';
import { useBracketData } from './useBracketData';
import { BracketMatch } from './BracketMatch';

// Height of one R32 slot. Later rounds have proportionally taller slots so each
// card sits vertically centred over the pair of feeders below it.
const SLOT_H = 120;
const TOTAL_H = 16 * SLOT_H; // 1920px — all columns are this height

// Match display order derived from a left-to-right DFS of the bracket tree.
// Adjacent entries in each round feed the same next-round match, which produces
// correct visual alignment without explicit connector lines.
const ROUNDS: { label: string; matchIds: number[] }[] = [
  { label: 'Round of 32',   matchIds: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87] },
  { label: 'Round of 16',   matchIds: [89, 90, 93, 94, 91, 92, 95, 96] },
  { label: 'Quarter-finals', matchIds: [97, 98, 99, 100] },
  { label: 'Semi-finals',   matchIds: [101, 102] },
  { label: 'Final',         matchIds: [104] },
];

export function Bracket() {
  const { bracket, teams, setPick, clearPick } = useBracketData();
  const champion = getChampion(bracket);
  const champTeam = champion ? teams[champion] : undefined;

  function handlePick(matchId: number, teamId: string) {
    // Toggle: clicking the current winner removes the pick.
    if (bracket[matchId]?.winnerId === teamId) {
      clearPick(matchId);
    } else {
      setPick(matchId, teamId);
    }
  }

  return (
    <section>
      <h2 style={{ marginBottom: 4 }}>Knockout Bracket</h2>
      <p className="screen-intro">
        Click a team to pick the winner. Click the selected team again to undo.
        The bracket re-seeds automatically when you adjust group or third-place rankings.
      </p>

      {/* Champion banner */}
      {champTeam && (
        <div className="champion-banner">
          <span className="champion-banner__trophy">🏆</span>
          <span className="champion-banner__flag">{champTeam.flag ?? '🏳️'}</span>
          <span className="champion-banner__name">{champTeam.name}</span>
          <span className="champion-banner__label">2026 World Cup Champion</span>
        </div>
      )}

      {/* Bracket grid — scrollable in both axes */}
      <div className="bracket-scroll">
        <div className="bracket-grid">
          {ROUNDS.map((round) => {
            const slotH = TOTAL_H / round.matchIds.length;

            return (
              <div key={round.label} className="round-col">
                <div className="round-head">{round.label}</div>

                {/* Match slots — fixed total height so cards align across rounds */}
                <div style={{ height: TOTAL_H }}>
                  {round.matchIds.map((matchId) => {
                    const slot = bracket[matchId];
                    return (
                      <div key={matchId} className="round-slot" style={{ height: slotH }}>
                        {slot && (
                          <BracketMatch
                            slot={slot}
                            teams={teams}
                            onPick={(teamId) => handlePick(matchId, teamId)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
