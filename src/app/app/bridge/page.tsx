// src/app/app/bridge/page.tsx
'use client';

import BridgePage from '../../bridge/page';
import { baseAppStyles } from '../baseAppStyles';

export default function BaseAppBridgePage() {
  return (
    <div className="base-app-root">
      <BridgePage />

      <style jsx global>{baseAppStyles}</style>
    </div>
  );
}