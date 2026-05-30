// src/app/api/xcup/render/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { WorldCupProphecyCardInput } from '../../../../lib/xcup/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: WorldCupProphecyCardInput | null = null;

  try {
    body = (await req.json()) as WorldCupProphecyCardInput;

    if (!body?.homeTeam || !body?.awayTeam || !body?.prophecy) {
      return NextResponse.json(
        { error: 'Invalid World Cup prophecy payload' },
        { status: 400 },
      );
    }

    const mod = await import('../../../../lib/xcup/renderProphecyCard');
    const png = await mod.renderWorldCupProphecyCard(body);

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Render failed';

    console.error('world cup prophecy render failed', {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      homeTeam: body?.homeTeam,
      awayTeam: body?.awayTeam,
    });

    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === 'development' && error instanceof Error
          ? { stack: error.stack }
          : {}),
      },
      { status: 500 },
    );
  }
}