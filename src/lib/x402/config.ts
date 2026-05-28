export type CookieverseX402Provider = "coinbase" | "bankr" | "disabled";

export type CookieverseX402Product = "roast-json" | "identity-roast";

export const x402Provider = (
  process.env.NEXT_PUBLIC_X402_PROVIDER || "disabled"
) as CookieverseX402Provider;

const coinbaseOrigin = (
  process.env.NEXT_PUBLIC_X402_COINBASE_ORIGIN || ""
).replace(/\/+$/, "");

export function getX402Endpoint(product: CookieverseX402Product) {
  if (x402Provider === "coinbase") {
    const path =
      product === "identity-roast"
        ? "/api/x402/coinbase/wallet-roast/identity"
        : "/api/x402/coinbase/wallet-roast/json";

    return coinbaseOrigin ? `${coinbaseOrigin}${path}` : path;
  }

  if (x402Provider === "bankr") {
    return product === "identity-roast"
      ? process.env.NEXT_PUBLIC_BANKR_X402_IDENTITY_ROAST_URL || ""
      : process.env.NEXT_PUBLIC_BANKR_X402_ROAST_JSON_URL || "";
  }

  return "";
}

export function isX402Enabled() {
  if (x402Provider === "coinbase") return true;

  if (x402Provider === "bankr") {
    return Boolean(
      process.env.NEXT_PUBLIC_BANKR_X402_ROAST_JSON_URL &&
        process.env.NEXT_PUBLIC_BANKR_X402_IDENTITY_ROAST_URL
    );
  }

  return false;
}

export const x402Enabled = isX402Enabled();