import { useEffect, useMemo } from 'react';
import { GROUP_IDS } from '../../domain/types';
import { useTournamentStore } from '../../store/tournamentStore';
import { TEAMS, FIXTURES } from '../../data/schedule2026';
import { GroupCard } from './GroupCard';
import { useGroupData } from './useGroupData';
import { computeAllStandings } from '../../domain/standings';

export function GroupStage() {
  const initialize = useTournamentStore((s) => s.initialize);
  const initializeGroupOrders = useTournamentStore((s) => s.initializeGroupOrders);
  const teams = useTournamentStore((s) => s.teams);

  // Load static data on first mount.
  useEffect(() => {
    initialize(TEAMS, FIXTURES);
  }, [initialize]);

  // Seed group orders once teams are loaded: pot/seed order before any games,
  // current standings order once a group has played matches.
  const teamList = useMemo(() => Object.values(teams), [teams]);
  useEffect(() => {
    if (teamList.length === 0) return;
    const standings = computeAllStandings(
      Object.fromEntries(teamList.map((t) => [t.id, t])),
      FIXTURES,
    );
    const seed = Object.fromEntries(
      GROUP_IDS.map((g) => {
        const potOrder = teamList.filter((t) => t.groupId === g).map((t) => t.id);
        const groupStandings = standings[g] ?? [];
        const anyPlayed = groupStandings.some((s) => s.played > 0);
        const order = anyPlayed ? groupStandings.map((s) => s.teamId) : potOrder;
        return [g, order];
      }),
    ) as Record<string, string[]>;
    initializeGroupOrders(seed);
  }, [teamList, initializeGroupOrders]);

  const groupData = useGroupData();

  // Group teams by their group id for quick lookup.
  const teamsByGroup = useMemo(() => {
    const map: Record<string, typeof teamList> = {};
    for (const g of GROUP_IDS) map[g] = [];
    for (const t of teamList) map[t.groupId].push(t);
    return map;
  }, [teamList]);

  if (teamList.length === 0) {
    return <p className="screen-intro">Loading groups…</p>;
  }

  return (
    <div>
      <p className="screen-intro">
        Drag teams within each group to set the final standings. Top 2 advance; the best 8 third-place teams also progress.
      </p>
      <div className="group-grid">
        {GROUP_IDS.map((g) => (
          <GroupCard
            key={g}
            groupId={g}
            teams={teamsByGroup[g]}
            groupData={groupData[g]}
          />
        ))}
      </div>
    </div>
  );
}
