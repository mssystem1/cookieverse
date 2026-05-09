// src/app/app/leaderboard/page.tsx
'use client';

import LeaderboardClient from '../../leaderboard/ui/LeaderboardClient';
import { baseAppStyles } from '../baseAppStyles';

export default function BaseAppLeaderboardPage() {
  return (
    <div className="base-app-root">
      <div className="page">
        <div className="grid">
          <div className="card card--wallet-roast card--leaderboard">
            <div className="card__title">Leaderboard</div>
            <LeaderboardClient mode="compact" />
          </div>
        </div>
      </div>

      <style jsx global>{baseAppStyles}</style>
    </div>
  );
}