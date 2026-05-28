import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;

  return timingSafeEqual(left, right);
}

export function requireCookieverseServiceKey(req: Request) {
  const expected = process.env.COOKIEVERSE_SERVICE_KEY;

  if (!expected) {
    throw new Error("Missing COOKIEVERSE_SERVICE_KEY");
  }

  const headerKey = req.headers.get("x-cookieverse-service-key") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : "";

  const provided = headerKey || bearer;

  if (!provided || !safeEqual(provided, expected)) {
    const err = new Error("Unauthorized Cookieverse service request");
    (err as any).status = 401;
    throw err;
  }
}