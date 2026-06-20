import { getPlayer, type MgidRow } from "../../server/mgidStore";
import { getX402UsageSummary, type X402Product } from "../../server/x402UsageStore";

export function totalBridges(row: MgidRow | null | undefined) {
  if (!row) return 0;

  return (
    Number(row.totalBridges_monad || 0) +
    Number(row.totalBridges_base || 0) +
    Number(row.totalBridges_mantle || 0) +
    Number(row.totalBridges_linea || 0) +
    Number(row.totalBridges_mitosis || 0) +
    Number(row.totalBridges_0g || 0) +
    Number(row.totalBridges_xlayer || 0) +
    Number(row.totalBridges_arbitrum || 0)
  );
}

export function totalMints(row: MgidRow | null | undefined) {
  if (!row) return 0;

  return Math.max(0, Number(row.totalTransactions || 0) - totalBridges(row));
}

export function totalImageMints(row: MgidRow | null | undefined) {
  if (!row) return 0;

  return Number(row.totalImages || 0);
}

export async function buildGalxeStats(address: `0x${string}`) {
  const [player, x402] = await Promise.all([
    getPlayer(address),
    getX402UsageSummary(address)
  ]);

  return {
    address,
    playerFound: Boolean(player),
    x402,
    mgid: {
      totalScore: Number(player?.totalScore || 0),
      totalMints: totalMints(player),
      totalImageMints: totalImageMints(player),
      totalBridges: totalBridges(player),
      dailyMintDone: Boolean(player?.dailyMintDone),
      dailyBridgeDone: Boolean(player?.dailyBridgeDone),
      weeklyMintDone: Boolean(player?.weeklyMintDone),
      weeklyBridgeDone: Boolean(player?.weeklyBridgeDone),
      updatedAt: player?.updatedAt ?? null
    }
  };
}

export function x402CountByProduct(
  summary: Awaited<ReturnType<typeof getX402UsageSummary>>,
  product: X402Product | "any"
) {
  if (product === "roast-json") return Number(summary.roastJson || 0);

  if (product === "identity-roast") return Number(summary.identityRoast || 0);

  if (product === "xcup-prophecy") return Number(summary.xcupProphecy || 0);

  return Number(summary.total || 0);
}
