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

      const rows = await getPlayersMany(addresses, {
        preferHistory: Boolean(payload.preferHistory || payload.strict),
      });
      return Response.json(
        { rows },
        { headers: { 'Cache-Control': 'no-store' } }
      );
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

      totalScore_xlayer: n(payload.totalScore_xlayer),
      totalTransactions_xlayer: n(payload.totalTransactions_xlayer),
      totalImages_xlayer: n(payload.totalImages_xlayer),      

      totalScore_arbitrum: n(payload.totalScore_arbitrum),
      totalTransactions_arbitrum: n(payload.totalTransactions_arbitrum),
      totalImages_arbitrum: n(payload.totalImages_arbitrum),

      totalX402_base: n(payload.totalX402_base),
      totalX402_mantle: n(payload.totalX402_mantle),
      totalX402_xlayer: n(payload.totalX402_xlayer),
      totalX402_arbitrum: n(payload.totalX402_arbitrum),

      totalX402Score_base: n(payload.totalX402Score_base ?? payload.totalX402_base),
      totalX402Score_mantle: n(payload.totalX402Score_mantle ?? payload.totalX402_mantle),
      totalX402Score_xlayer: n(payload.totalX402Score_xlayer ?? payload.totalX402_xlayer),
      totalX402Score_arbitrum: n(
        payload.totalX402Score_arbitrum ?? payload.totalX402_arbitrum
      ),

      totalX402: n(payload.totalX402),
      totalX402Score: n(payload.totalX402Score ?? payload.totalX402),

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
      totalBridges_xlayer: n(payload.totalBridges_xlayer),
      totalBridges_arbitrum: n(payload.totalBridges_arbitrum),

      dailyKey: payload.dailyKey,
      dailyBaselineCookies: n(payload.dailyBaselineCookies),
      dailyBaselineBridges: n(payload.dailyBaselineBridges),
      dailyBaselineX402: n(payload.dailyBaselineX402),
      dailyMintDone: payload.dailyMintDone,
      dailyBridgeDone: payload.dailyBridgeDone,
      dailyX402Done: payload.dailyX402Done,

      weeklyKey: payload.weeklyKey,
      weeklyBaselineCookies: n(payload.weeklyBaselineCookies),
      weeklyBaselineBridges: n(payload.weeklyBaselineBridges),
      weeklyBaselineX402: n(payload.weeklyBaselineX402),
      weeklyMintDone: payload.weeklyMintDone,
      weeklyBridgeDone: payload.weeklyBridgeDone,
      weeklyX402Done: payload.weeklyX402Done,
    };

    row.totalX402 = row.totalX402 || (
      row.totalX402_base + row.totalX402_mantle + row.totalX402_xlayer +
      row.totalX402_arbitrum
    );

    row.totalX402Score = row.totalX402Score || (
      row.totalX402Score_base + row.totalX402Score_mantle +
      row.totalX402Score_xlayer + row.totalX402Score_arbitrum
    );

    // If caller did not send global totals, derive them from per-chain fields.
    row.totalScore = row.totalScore || (
      row.totalScore_monad + row.totalScore_base + row.totalScore_mantle +
      row.totalScore_linea + row.totalScore_mitosis + row.totalScore_0g +
      row.totalScore_xlayer + row.totalScore_arbitrum
    );

    row.totalTransactions = row.totalTransactions || (
      row.totalTransactions_monad + row.totalTransactions_base + row.totalTransactions_mantle +
      row.totalTransactions_linea + row.totalTransactions_mitosis +
      row.totalTransactions_0g + row.totalTransactions_xlayer +
      row.totalTransactions_arbitrum
    );

    row.totalImages = row.totalImages || (
      row.totalImages_monad + row.totalImages_base + row.totalImages_mantle +
      row.totalImages_linea + row.totalImages_mitosis + row.totalImages_0g +
      row.totalImages_xlayer + row.totalImages_arbitrum
    );

    await upsertPlayer(row as any);
    return Response.json({ ok: true, row });
  } catch (err) {
    console.error('mgid-downsert error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
