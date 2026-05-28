import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";

import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const rawPrivateKey = process.env.SIGNER_PRIVATE_KEY;

const endpoint =
  process.env.TEST_X402_ENDPOINT ||
  "https://x402.bankr.bot/0xb2bba27d30e146e12a53daf4d6f476430fda4e27/ping";

if (!rawPrivateKey) {
  throw new Error("Missing SIGNER_PRIVATE_KEY");
}

const privateKey = rawPrivateKey.startsWith("0x")
  ? (rawPrivateKey as `0x${string}`)
  : (`0x${rawPrivateKey}` as `0x${string}`);

const account = privateKeyToAccount(privateKey);

const wallet = createWalletClient({
  account,
  chain: base,
  transport: http(process.env.BASE_RPC_URL || "https://mainnet.base.org"),
}).extend(publicActions);

// 0.01 USDC max. USDC has 6 decimals.
const maxPaymentAtomic = 10_000n;

// x402-fetch type definitions currently conflict with some viem/Base chain types.
// Runtime object is valid, so cast only in this debug script.
const paidFetch = wrapFetchWithPayment(fetch, wallet as any, maxPaymentAtomic);

async function main() {
  console.log("payer:", account.address);
  console.log("endpoint:", endpoint);

  const res = await paidFetch(endpoint, {
    method: "GET",
  });

  const text = await res.text();

  console.log("status:", res.status);
  console.log("headers:", Object.fromEntries(res.headers.entries()));
  console.log("body:", text);
}

main().catch((err) => {
  console.error("x402 test failed:");
  console.error(err);
  process.exit(1);
});