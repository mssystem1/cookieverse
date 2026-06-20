export type CookieverseX402Provider =
  | "coinbase"
  | "bankr"
  | "questflow"
  | "mantle-devkit"
  | "cookieverse-mantle"
  | "okx"
  | "disabled";

export type CookieverseX402Product =
  | "roast-json"
  | "identity-roast"
  | "xcup-prophecy";

export type CookieverseX402Chain = "base" | "mantle" | "xlayer" | "arbitrum";

export const x402Provider = (
  process.env.NEXT_PUBLIC_X402_PROVIDER || "disabled"
) as CookieverseX402Provider;

const coinbaseOrigin = (
  process.env.NEXT_PUBLIC_X402_COINBASE_ORIGIN || ""
).replace(/\/+$/, "");

const mantleX402Provider = (
  process.env.NEXT_PUBLIC_X402_MANTLE_PROVIDER || "questflow"
) as CookieverseX402Provider;

function localOriginPath(path: string) {
  return coinbaseOrigin ? `${coinbaseOrigin}${path}` : path;
}

export function getX402ProviderForChain(
  chain: CookieverseX402Chain
): CookieverseX402Provider {
  if (chain === "base") {
    return x402Provider === "coinbase" ? "coinbase" : "disabled";
  }

  if (chain === "arbitrum") {
    return process.env.NEXT_PUBLIC_X402_ARBITRUM_ENABLED === "false"
      ? "disabled"
      : "coinbase";
  }

  if (chain === "mantle") {
    if (process.env.NEXT_PUBLIC_X402_MANTLE_ENABLED !== "true") {
      return "disabled";
    }

    if (mantleX402Provider === "mantle-devkit") return "mantle-devkit";
    if (mantleX402Provider === "cookieverse-mantle") {
      return "cookieverse-mantle";
    }

    return "questflow";
  }

  if (chain === "xlayer") {
    return process.env.NEXT_PUBLIC_X402_XLAYER_ENABLED === "false"
      ? "disabled"
      : "okx";
  }

  return "disabled";
}

export function getX402Endpoint(
  product: CookieverseX402Product,
  chain: CookieverseX402Chain = "base"
) {
  const provider = getX402ProviderForChain(chain);

  if (provider === "coinbase") {
    if (chain === "arbitrum") {
      if (product === "roast-json") return "";

      return product === "xcup-prophecy"
        ? localOriginPath("/api/x402/coinbase/arbitrum/xcup/prophecy")
        : localOriginPath(
            "/api/x402/coinbase/arbitrum/wallet-roast/identity"
          );
    }

    if (product === "xcup-prophecy") {
      return localOriginPath("/api/x402/coinbase/xcup/prophecy");
    }

    const path =
      product === "identity-roast"
        ? "/api/x402/coinbase/wallet-roast/identity"
        : "/api/x402/coinbase/wallet-roast/json";

    return localOriginPath(path);
  }

  if (provider === "bankr") {
    return product === "identity-roast"
      ? process.env.NEXT_PUBLIC_BANKR_X402_IDENTITY_ROAST_URL || ""
      : process.env.NEXT_PUBLIC_BANKR_X402_ROAST_JSON_URL || "";
  }

  if (provider === "questflow") {
    if (product === "xcup-prophecy") {
      return localOriginPath("/api/x402/questflow/xcup/prophecy");
    }

    return localOriginPath("/api/x402/questflow/wallet-roast/identity");
  }

  if (provider === "mantle-devkit") {
    if (product === "xcup-prophecy") {
      return localOriginPath("/api/x402/mantle-devkit/xcup/prophecy");
    }

    return localOriginPath("/api/x402/mantle-devkit/wallet-roast/identity");
  }

  if (provider === "cookieverse-mantle") {
    if (product === "xcup-prophecy") {
      return localOriginPath("/api/x402/mantle-native/xcup/prophecy");
    }

    return localOriginPath("/api/x402/mantle-native/wallet-roast/identity");
  }

  if (provider === "okx") {
    if (product === "xcup-prophecy") {
      return localOriginPath("/api/x402/okx/xcup/prophecy");
    }

    return localOriginPath("/api/x402/okx/wallet-roast/identity");
  }

  return "";
}

export function isX402Enabled(chain: CookieverseX402Chain = "base") {
  const provider = getX402ProviderForChain(chain);

  if (provider === "coinbase") return true;

  if (provider === "bankr") {
    return Boolean(
      process.env.NEXT_PUBLIC_BANKR_X402_ROAST_JSON_URL &&
        process.env.NEXT_PUBLIC_BANKR_X402_IDENTITY_ROAST_URL
    );
  }

  if (provider === "questflow") return true;
  if (provider === "mantle-devkit") return true;
  if (provider === "cookieverse-mantle") return true;
  if (provider === "okx") return true;

  return false;
}

export const x402Enabled = isX402Enabled();
