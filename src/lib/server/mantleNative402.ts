import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  getAddress,
  http,
  isAddress,
  isAddressEqual,
  type Hash,
} from "viem";
import { mantle } from "viem/chains";
import { createPublicClient } from "viem";

export type MantleNativeProduct = "wallet-roast" | "xcup-prophecy";

type PaymentAuditEvent = {
  txHash: Hash;
  payer: `0x${string}`;
  payTo: `0x${string}`;
  amountWei: string;
  requiredWei: string;
  product: MantleNativeProduct;
  featureRequestHash: string;
  chainId: 5000;
  blockNumber: string;
  createdAt: number;
};

const CHAIN_ID = 5000;
const NETWORK = "eip155:5000";
const DEFAULT_PRICE_WEI = 100000000000000000n; // 0.1 MNT
const AUDIT_PREFIX = "fortune-cookie/mantle-native-402";

function allowedOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (
    (origin && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) ||
    origin === "http://127.0.0.1:3000" ||
    origin === "http://localhost:3000" ||
    origin === "https://cookieverse.tech" ||
    origin === "https://www.cookieverse.tech"
  ) {
    return origin;
  }

  return "http://127.0.0.1:3000";
}

export function mantleNativeCorsHeaders(req: NextRequest) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin(req),
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-402-Transaction-Hash, x-402-transaction-hash",
    "Access-Control-Expose-Headers":
      "payment-required, PAYMENT-REQUIRED, X-402-Amount, X-402-Token, X-402-Network, X-402-Chain-Id, X-402-Recipient",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function isEnabled() {
  return (
    process.env.NEXT_PUBLIC_X402_MANTLE_ENABLED === "true" &&
    process.env.X402_MANTLE_SERVER_PROVIDER === "cookieverse-mantle"
  );
}

function payTo() {
  const value = (
    process.env.MANTLE_PAY_TO ||
    process.env.MANTLE_NATIVE_PAY_TO ||
    process.env.X402_MANTLE_PAY_TO ||
    ""
  ).trim();

  if (!isAddress(value)) {
    throw new Error("Missing or invalid MANTLE_PAY_TO.");
  }

  return getAddress(value);
}

function productPriceWei(product: MantleNativeProduct) {
  const raw =
    product === "xcup-prophecy"
      ? process.env.MANTLE_XCUP_PROPHECY_PRICE_WEI
      : process.env.MANTLE_WALLET_ROAST_PRICE_WEI;

  if (!raw) return DEFAULT_PRICE_WEI;

  try {
    const value = BigInt(raw);
    if (value <= 0n) throw new Error("price must be positive");
    return value;
  } catch {
    throw new Error(`Invalid Mantle price wei for ${product}: ${raw}`);
  }
}

function productDescription(product: MantleNativeProduct) {
  return product === "xcup-prophecy"
    ? "Cookieverse World Cup Match Prophecy on Mantle"
    : "Cookieverse Wallet Roast on Mantle";
}

function requestHash(product: MantleNativeProduct, body: any) {
  const wallet = String(body.wallet || body.address || "").toLowerCase();

  const payload =
    product === "xcup-prophecy"
      ? [
          product,
          wallet,
          String(body.homeTeam || "").trim().toLowerCase(),
          String(body.awayTeam || body.visitorTeam || "").trim().toLowerCase(),
          String(body.matchDate || body.kickoff || "").trim().toLowerCase(),
        ].join(":")
      : [product, wallet].join(":");

  return createHash("sha256").update(payload).digest("hex");
}

function paymentRequired(req: NextRequest, product: MantleNativeProduct) {
  const amount = productPriceWei(product).toString();
  const recipient = payTo();
  const resource = req.nextUrl.pathname;
  const body = {
    ok: false,
    error: "Payment Required",
    x402Version: 2,
    provider: "cookieverse-mantle",
    accepts: [
      {
        scheme: "mantle-native-exact",
        network: NETWORK,
        chainId: CHAIN_ID,
        asset: "MNT",
        amount,
        payTo: recipient,
        product,
        resource,
        description: productDescription(product),
      },
    ],
  };

  const encoded =
    typeof btoa === "function"
      ? btoa(JSON.stringify(body))
      : Buffer.from(JSON.stringify(body), "utf8").toString("base64");

  return NextResponse.json(body, {
    status: 402,
    headers: {
      ...mantleNativeCorsHeaders(req),
      "Cache-Control": "no-store",
      "payment-required": encoded,
      "X-402-Amount": amount,
      "X-402-Token": "MNT",
      "X-402-Network": "mantle",
      "X-402-Chain-Id": String(CHAIN_ID),
      "X-402-Recipient": recipient,
    },
  });
}

function jsonError(req: NextRequest, message: string, status = 402) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      provider: "cookieverse-mantle",
    },
    {
      status,
      headers: {
        ...mantleNativeCorsHeaders(req),
        "Cache-Control": "no-store",
      },
    }
  );
}

function publicClient() {
  return createPublicClient({
    chain: mantle,
    transport: http(process.env.MANTLE_RPC_URL || "https://rpc.mantle.xyz"),
  });
}

function normalizeHash(value: unknown): Hash | null {
  const raw = String(value || "").trim();
  return /^0x[a-fA-F0-9]{64}$/.test(raw) ? (raw as Hash) : null;
}

async function recordAudit(event: PaymentAuditEvent) {
  const token = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!token) return;

  try {
    await put(
      `${AUDIT_PREFIX}/${event.payer.toLowerCase()}/${event.createdAt}-${event.txHash}.json`,
      JSON.stringify(event),
      {
        token,
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: false,
      }
    );
  } catch (error) {
    console.warn(
      "[cookieverse:mantle-native-402-audit-failed]",
      error instanceof Error ? error.message : error
    );
  }
}

async function claimReplayLock(event: PaymentAuditEvent) {
  const restUrl = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ""
  ).replace(/\/+$/, "");
  const restToken =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    "";

  if (!restUrl || !restToken) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[cookieverse:mantle-native-402-redis-missing]",
        "Upstash Redis REST env missing; allowing local development payment without replay lock."
      );
      return true;
    }

    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN for Mantle payment replay protection."
    );
  }

  const key = `mantle-payment:${event.txHash.toLowerCase()}`;
  const value = JSON.stringify(event);
  const res = await fetch(restUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${restToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(["SET", key, value, "NX"]),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Upstash Redis replay lock failed: HTTP ${res.status}`);
  }

  const data = (await res.json().catch(() => ({}))) as { result?: unknown };
  return data.result === "OK";
}

export async function requireMantleNativePayment(
  req: NextRequest,
  product: MantleNativeProduct,
  body: any
) {
  if (!isEnabled()) {
    return jsonError(req, "Cookieverse Mantle-native payments are disabled.", 503);
  }

  const payerRaw = String(body.wallet || body.address || "").trim();
  if (!isAddress(payerRaw)) {
    return jsonError(req, "Invalid payer wallet address.", 400);
  }

  const txHash =
    normalizeHash(body.paymentTxHash) ||
    normalizeHash(req.headers.get("x-402-transaction-hash"));

  if (!txHash) {
    return paymentRequired(req, product);
  }

  const payer = getAddress(payerRaw);
  const recipient = payTo();
  const requiredWei = productPriceWei(product);
  const client = publicClient();

  let tx: Awaited<ReturnType<typeof client.getTransaction>>;
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;

  try {
    [tx, receipt] = await Promise.all([
      client.getTransaction({ hash: txHash }),
      client.getTransactionReceipt({ hash: txHash }),
    ]);
  } catch {
    return jsonError(req, "Payment transaction was not found on Mantle yet.");
  }

  if (receipt.status !== "success") {
    return jsonError(req, "Payment transaction failed.");
  }

  if (!tx.to || !isAddressEqual(tx.to, recipient)) {
    return jsonError(req, "Payment receiver does not match Cookieverse treasury.");
  }

  if (!isAddressEqual(tx.from, payer)) {
    return jsonError(req, "Payment sender does not match connected wallet.");
  }

  if (tx.value < requiredWei) {
    return jsonError(req, "Payment amount is too small.");
  }

  if (tx.chainId && Number(tx.chainId) !== CHAIN_ID) {
    return jsonError(req, "Payment transaction is not on Mantle mainnet.");
  }

  const event: PaymentAuditEvent = {
    txHash,
    payer,
    payTo: recipient,
    amountWei: tx.value.toString(),
    requiredWei: requiredWei.toString(),
    product,
    featureRequestHash: requestHash(product, body),
    chainId: CHAIN_ID,
    blockNumber: receipt.blockNumber.toString(),
    createdAt: Date.now(),
  };

  const claimed = await claimReplayLock(event);
  if (!claimed) {
    return jsonError(req, "Payment transaction was already used.", 409);
  }

  await recordAudit(event);

  return null;
}
