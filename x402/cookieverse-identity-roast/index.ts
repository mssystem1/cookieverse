type CookieverseRequest = {
  wallet?: string;
  address?: string;
  style?: "cookieverse" | "light" | "savage" | "degen" | "founder";
};

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export default async function handler(req: Request) {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Use POST" }, 405);
    }

    const upstream = process.env.COOKIEVERSE_API_URL;
    const serviceKey = process.env.COOKIEVERSE_SERVICE_KEY;

    if (!upstream) {
      return jsonResponse({ ok: false, error: "Missing COOKIEVERSE_API_URL" }, 500);
    }

    if (!serviceKey) {
      return jsonResponse({ ok: false, error: "Missing COOKIEVERSE_SERVICE_KEY" }, 500);
    }

    const body = (await req.json()) as CookieverseRequest;
    const wallet = String(body.wallet || body.address || "").trim();

    if (!EVM_ADDRESS_RE.test(wallet)) {
      return jsonResponse({ ok: false, error: "Invalid EVM wallet address" }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 29000);

    try {
      const res = await fetch(`${upstream.replace(/\/+$/, "")}/api/wallet-roast/pro`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Cookieverse-Service-Key": serviceKey,
          "X-Cookieverse-X402-Product": "identity-roast"
        },
        body: JSON.stringify({
          wallet,
          chain: "base",
          style: body.style || "cookieverse",
          product: "identity-roast",
          includeImage: true,
          includeMintMetadata: true
        })
      });

      const text = await res.text();

      return new Response(text, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store"
        }
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "x402 identity-roast handler failed";
    const isTimeout = message.toLowerCase().includes("abort");

    return jsonResponse(
      {
        ok: false,
        error: isTimeout ? "Cookieverse upstream timed out" : message
      },
      isTimeout ? 504 : 500
    );
  }
}