import { NextRequest } from "next/server";
import {
  galxeJson,
  galxeOptions,
  normalizeEvmAddress,
  numberParam,
  requireGalxeSecret
} from "../../../../lib/galxe/response";
import { getPlayer } from "../../../../server/mgidStore";
import { totalBridges } from "../../../../lib/galxe/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return galxeOptions(req);
}

export async function GET(req: NextRequest) {
  try {
    requireGalxeSecret(req);

    const address = normalizeEvmAddress(req.nextUrl.searchParams.get("address"));

    if (!address) {
      return galxeJson(
        { ok: false, eligible: false, error: "Invalid address" },
        400,
        req,
      );
    }

    const min = numberParam(req, "min", 1, { min: 1, max: 10000 });
    const player = await getPlayer(address);
    const count = totalBridges(player);
    const eligible = count >= min;

    return galxeJson({
      ok: true,
      type: "bridge",
      address,
      min,
      count,
      eligible,
      updatedAt: player?.updatedAt ?? null,
      chains: {
        monad: Number(player?.totalBridges_monad || 0),
        base: Number(player?.totalBridges_base || 0),
        mantle: Number(player?.totalBridges_mantle || 0),
        linea: Number(player?.totalBridges_linea || 0),
        mitosis: Number(player?.totalBridges_mitosis || 0),
        og: Number(player?.totalBridges_0g || 0),
        xlayer: Number(player?.totalBridges_xlayer || 0)        
      }
    },
    200,
    req,
   );
  } catch (error) {
    const status = (error as any)?.status || 500;

    return galxeJson(
      {
        ok: false,
        eligible: false,
        error: error instanceof Error ? error.message : "Galxe x402 check failed",
      },
      status,
      req,
    );
  }
}