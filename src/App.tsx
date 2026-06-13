import { useState } from 'react';
import { GroupStage } from './features/GroupStage/GroupStage';
import { ThirdPlace } from './features/ThirdPlace/ThirdPlace';
import { Bracket } from './features/Bracket/Bracket';
import { StageNav, type StageKey } from './features/shared/StageNav';
import './App.css';

export default function App() {
  const [stage, setStage] = useState<StageKey>('groups');

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1 className="app-title">World Cup 2026 Possibilities</h1>
        <p className="app-subtitle">
          Build your own road to the final — set the groups, rank the third-place
          teams, and play out the knockout bracket.
        </p>
      </header>
      <StageNav current={stage} onChange={setStage} />
      {stage === 'groups' && <GroupStage />}
      {stage === 'thirdPlace' && <ThirdPlace />}
      {stage === 'bracket' && <Bracket />}
    </main>
  );
}
