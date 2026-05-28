import { NextRequest } from "next/server";
import {
  galxeJson,
  galxeOptions,
  normalizeEvmAddress,
  numberParam,
  requireGalxeSecret,
  stringParam
} from "../../../../lib/galxe/response";
import { getX402UsageSummary, type X402Product } from "../../../../server/x402UsageStore";
import { x402CountByProduct } from "../../../../lib/galxe/stats";

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

    const rawProduct = stringParam(req, "product", "any");

    const product =
      rawProduct === "roast-json" ||
      rawProduct === "identity-roast" ||
      rawProduct === "any"
        ? (rawProduct as X402Product | "any")
        : "any";

    const min = numberParam(req, "min", 1, { min: 1, max: 1000 });

    const summary = await getX402UsageSummary(address);
    const count = x402CountByProduct(summary, product);
    const eligible = count >= min;

    return galxeJson({
      ok: true,
      type: "x402",
      address,
      product,
      min,
      count,
      eligible,
      summary
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