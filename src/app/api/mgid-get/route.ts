import { getPlayer } from '../../../server/mgidStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address') as `0x${string}` | null;
  if (!address) return Response.json({ ok: false, error: 'address required' }, { status: 400 });

  const row = await getPlayer(address);
  return Response.json(row || null);
}
