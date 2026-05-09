// src/app/app/page.tsx
'use client';

import MainPage from '../page';
import { baseAppStyles } from './baseAppStyles';

export default function BaseAppPage() {
  return (
    <div className="base-app-root">
      <MainPage />

      <style jsx global>{baseAppStyles}</style>
    </div>
  );
}