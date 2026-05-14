import { getPlayersMany, upsertPlayer } from '../../../server/mgidStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function n(value: unknown): number {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Mode A: read-many for leaderboard/dashboard enrichment
    if (payload && payload.op === 'readMany') {
      const addresses = Array.isArray(payload.addresses) ? payload.addresses : [];
      if (!addresses.length) {
        return Response.json({ rows: [] });
      }

      const rows = await getPlayersMany(addresses);
      return Response.json({ rows });
    }

    // Mode B: manual upsert single player.
    // Keep all old fields and add 0G fields so Blob read/write is symmetric.
    const row = {
      usernameX: payload.usernameX ?? '',
      usernamefarcaster: payload.usernamefarcaster ?? '',

      EOAWallet: payload.EOAWallet,
      SAWallet: payload.SAWallet,

      LineaBoost: n(payload.LineaBoost),
      BaseBoost: n(payload.BaseBoost),
      MonadBoost: n(payload.MonadBoost),
      MantleBoost: n(payload.MantleBoost),
      MitosisBoost: n(payload.MitosisBoost),

      totalScore_monad: n(payload.totalScore_monad),
      totalTransactions_monad: n(payload.totalTransactions_monad),
      totalImages_monad: n(payload.totalImages_monad),

      totalScore_base: n(payload.totalScore_base),
      totalTransactions_base: n(payload.totalTransactions_base),
      totalImages_base: n(payload.totalImages_base),

      totalScore_mantle: n(payload.totalScore_mantle),
      totalTransactions_mantle: n(payload.totalTransactions_mantle),
      totalImages_mantle: n(payload.totalImages_mantle),

      totalScore_linea: n(payload.totalScore_linea),
      totalTransactions_linea: n(payload.totalTransactions_linea),
      totalImages_linea: n(payload.totalImages_linea),

      totalScore_mitosis: n(payload.totalScore_mitosis),
      totalTransactions_mitosis: n(payload.totalTransactions_mitosis),
      totalImages_mitosis: n(payload.totalImages_mitosis),

      totalScore_0g: n(payload.totalScore_0g),
      totalTransactions_0g: n(payload.totalTransactions_0g),
      totalImages_0g: n(payload.totalImages_0g),

      totalScore: n(payload.totalScore),
      totalTransactions: n(payload.totalTransactions),
      totalImages: n(payload.totalImages),
      updatedAt: Date.now(),

      totalBridges_monad: n(payload.totalBridges_monad),
      totalBridges_base: n(payload.totalBridges_base),
      totalBridges_mantle: n(payload.totalBridges_mantle),
      totalBridges_linea: n(payload.totalBridges_linea),
      totalBridges_mitosis: n(payload.totalBridges_mitosis),
      totalBridges_0g: n(payload.totalBridges_0g),

      dailyKey: payload.dailyKey,
      dailyBaselineCookies: n(payload.dailyBaselineCookies),
      dailyBaselineBridges: n(payload.dailyBaselineBridges),
      dailyMintDone: payload.dailyMintDone,
      dailyBridgeDone: payload.dailyBridgeDone,

      weeklyKey: payload.weeklyKey,
      weeklyBaselineCookies: n(payload.weeklyBaselineCookies),
      weeklyBaselineBridges: n(payload.weeklyBaselineBridges),
      weeklyMintDone: payload.weeklyMintDone,
      weeklyBridgeDone: payload.weeklyBridgeDone,
    };

    // If caller did not send global totals, derive them from per-chain fields.
    row.totalScore = row.totalScore || (
      row.totalScore_monad + row.totalScore_base + row.totalScore_mantle +
      row.totalScore_linea + row.totalScore_mitosis + row.totalScore_0g
    );

    row.totalTransactions = row.totalTransactions || (
      row.totalTransactions_monad + row.totalTransactions_base + row.totalTransactions_mantle +
      row.totalTransactions_linea + row.totalTransactions_mitosis + row.totalTransactions_0g
    );

    row.totalImages = row.totalImages || (
      row.totalImages_monad + row.totalImages_base + row.totalImages_mantle +
      row.totalImages_linea + row.totalImages_mitosis + row.totalImages_0g
    );

    await upsertPlayer(row as any);
    return Response.json({ ok: true, row });
  } catch (err) {
    console.error('mgid-downsert error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
