import { getPlayersMany, upsertPlayer } from '../../../server/mgidStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // 🔹 Mode A: read-many for leaderboard
    if (payload && payload.op === 'readMany') {
      const addresses = Array.isArray(payload.addresses) ? payload.addresses : [];
      if (!addresses.length) {
        return Response.json({ rows: [] });
      }
      const rows = await getPlayersMany(addresses);
      return Response.json({ rows });
    }

    // 🔹 Mode B: upsert single player (existing behavior)
    const row = {
      usernameX: payload.usernameX ?? '',
      usernamefarcaster: payload.usernamefarcaster ?? '',
      EOAWallet: payload.EOAWallet,
      SAWallet: payload.SAWallet,
      LineaBoost: Number(payload.LineaBoost || 0),
      BaseBoost: Number(payload.BaseBoost || 0),
      MonadBoost: Number(payload.MonadBoost || 0),
      MantleBoost: Number(payload.MantleBoost || 0),
      MitosisBoost: Number(payload.MitosisBoost || 0),
      totalScore_monad: Number(payload.totalScore_monad || 0),
      totalTransactions_monad: Number(payload.totalTransactions_monad || 0),
      totalImages_monad: Number(payload.totalImages_monad || 0),
      totalScore_base: Number(payload.totalScore_base || 0),
      totalTransactions_base: Number(payload.totalTransactions_base || 0),
      totalImages_base: Number(payload.totalImages_base || 0),
      totalScore_mantle: Number(payload.totalScore_mantle || 0),
      totalTransactions_mantle: Number(payload.totalTransactions_mantle || 0),
      totalImages_mantle: Number(payload.totalImages_mantle || 0),
      totalScore_linea: Number(payload.totalScore_linea || 0),
      totalTransactions_linea: Number(payload.totalTransactions_linea || 0),
      totalImages_linea: Number(payload.totalImages_linea || 0),
      totalScore_mitosis: Number(payload.totalScore_mitosis || 0),
      totalTransactions_mitosis: Number(payload.totalTransactions_mitosis || 0),
      totalImages_mitosis: Number(payload.totalImages_mitosis || 0),
      totalScore: Number(payload.totalScore || 0),
      totalTransactions: Number(payload.totalTransactions || 0),
      totalImages: Number(payload.totalImages || 0),
      updatedAt: Date.now(),

      // 🔹 NEW: allow writing bridge totals manually (optional)
      totalBridges_monad: Number(payload.totalBridges_monad || 0),
      totalBridges_base: Number(payload.totalBridges_base || 0),
      totalBridges_mantle: Number(payload.totalBridges_mantle || 0),
      totalBridges_linea: Number(payload.totalBridges_linea || 0),
      totalBridges_mitosis: Number(payload.totalBridges_mitosis || 0),

      // 🔹 Daily tasks (UTC-based)
      dailyKey: payload.dailyKey,               // 'YYYY-MM-DD' (UTC)
      dailyBaselineCookies: Number(payload.dailyBaselineCookies || 0),    // total cookies at start of that day
      dailyBaselineBridges: Number(payload.dailyBaselineBridges || 0),   // total bridges at start of that day
      dailyMintDone: payload.dailyMintDone,          // "Mint at least 2 COOKIEs" – logic in mgid-upsert
      dailyBridgeDone: payload.dailyBridgeDone,        // "Bridge 2 COOKIEs"

      // 🔹 Weekly tasks (UTC-based ISO week)
      weeklyKey: payload.weeklyKey,          // 'YYYY-Www' (UTC ISO week)
      weeklyBaselineCookies: Number(payload.weeklyBaselineCookies || 0),  // total cookies at start of week
      weeklyBaselineBridges: Number(payload.weeklyBaselineBridges || 0),   // total bridges at start of week
      weeklyMintDone: payload.weeklyMintDone,          // "Mint 8+ cookies this week"
      weeklyBridgeDone: payload.weeklyBridgeDone,        // "Bridge 8+ times this week"
    };

    await upsertPlayer(row as any);
    return Response.json({ ok: true });
  } catch (err) {
    console.error('mgid-upsert error', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}