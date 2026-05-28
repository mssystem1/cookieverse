import { NextRequest } from "next/server";
import {
  galxeJson,
  galxeOptions,
  normalizeEvmAddress,
  numberParam,
  requireGalxeSecret,
  stringParam
} from "../../../../lib/galxe/response";
import { getPlayer } from "../../../../server/mgidStore";
import { totalImageMints, totalMints } from "../../../../lib/galxe/stats";

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

    const type = stringParam(req, "type", "any");
    const min = numberParam(req, "min", 1, { min: 1, max: 10000 });
    const player = await getPlayer(address);

    const count = type === "image" ? totalImageMints(player) : totalMints(player);
    const eligible = count >= min;

    return galxeJson({
      ok: true,
      type: "mint",
      mintType: type === "image" ? "image" : "any",
      address,
      min,
      count,
      eligible,
      updatedAt: player?.updatedAt ?? null
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