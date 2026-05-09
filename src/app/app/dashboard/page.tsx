// src/app/app/dashboard/page.tsx
'use client';

import DashboardClient from '../../dashboard/ui/DashboardClient';
import { baseAppStyles } from '../baseAppStyles';

export default function BaseAppDashboardPage() {
  return (
    <div className="base-app-root">
      <div className="page">
        <div className="grid">
          <div className="card card--wallet-roast">
            <div className="card__title">Cookieverse Dashboard</div>
            <DashboardClient />
          </div>
        </div>
      </div>

      <style jsx global>{baseAppStyles}</style>
    </div>
  );
}