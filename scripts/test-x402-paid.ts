import { x402Client, wrapFetchWithPayment, x402HTTPClient } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
const endpoint =
  process.env.X402_TEST_URL ||
  "http://127.0.0.1:3000/api/x402/wallet-roast/json";

const walletToRoast =
  process.env.X402_TEST_WALLET ||
  "0xA7d827622c4F9c884cA8F751b2060DD767F18683";

if (!privateKey) {
  throw new Error("Missing EVM_PRIVATE_KEY in .env.x402.local");
}

const signer = privateKeyToAccount(privateKey);

const client = new x402Client();
registerExactEvmScheme(client, { signer });

const fetchWithPayment = wrapFetchWithPayment(fetch, client);

async function main() {
  console.log("payer:", signer.address);
  console.log("endpoint:", endpoint);
  console.log("walletToRoast:", walletToRoast);

  const response = await fetchWithPayment(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wallet: walletToRoast,
    }),
  });

  const text = await response.text();

  console.log("status:", response.status);
  console.log("headers:", Object.fromEntries(response.headers.entries()));
  console.log("body:", text);

  if (response.ok) {
    const httpClient = new x402HTTPClient(client);
    const paymentResponse = httpClient.getPaymentSettleResponse((name) =>
      response.headers.get(name),
    );

    console.log("paymentResponse:", paymentResponse);
  }
}

main().catch((error) => {
  console.error("paid x402 test failed:");
  console.error(error);
  process.exit(1);
});