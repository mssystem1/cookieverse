/*
import OpenAI from "openai";
import { getOgBroker } from "./ogBroker";
import { walletRoastConfig } from "./config";

const acknowledgedProviders = new Set<string>();

async function ensureProviderAcknowledged() {
  if (acknowledgedProviders.has(walletRoastConfig.ogProviderAddress)) return;

  const broker = await getOgBroker();
  await broker.inference.acknowledgeProviderSigner(
    walletRoastConfig.ogProviderAddress
  );
  acknowledgedProviders.add(walletRoastConfig.ogProviderAddress);
}

async function ensureLedgerFunded() {
  const broker = await getOgBroker();

  try {
    const ledger = await broker.ledger.getLedger();
    const hasLedger =
      ledger &&
      Array.isArray((ledger as any).ledgerInfo) &&
      (ledger as any).ledgerInfo.length > 0;

    if (!hasLedger) {
      await broker.ledger.addLedger(walletRoastConfig.ogLedgerFundAmount);
    }
  } catch {
    await broker.ledger.addLedger(walletRoastConfig.ogLedgerFundAmount);
  }
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};

  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value === "string") {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.join(", ");
    } else if (value != null) {
      out[key] = String(value);
    }
  }

  return out;
}

export async function createOgOpenAIClient(prompt: string) {
  const broker = await getOgBroker();

  await ensureLedgerFunded();
  await ensureProviderAcknowledged();

  const { endpoint, model } = await broker.inference.getServiceMetadata(
    walletRoastConfig.ogProviderAddress
  );

  const rawHeaders = await broker.inference.getRequestHeaders(
    walletRoastConfig.ogProviderAddress,
    prompt
  );

  const defaultHeaders = normalizeHeaders(rawHeaders);

  const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: "unused", // empty string as per docs
    defaultHeaders,
  });

  return { broker, openai, model };
}
*/

import OpenAI from "openai";
import { ethers } from "ethers";
import { getOgBroker, getOgSigner } from "./ogBroker";
import { walletRoastConfig } from "./config";

const acknowledgedProviders = new Set<string>();

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== "object") return {};

  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof value === "string") {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.join(", ");
    } else if (value != null) {
      out[key] = String(value);
    }
  }

  return out;
}

function toWeiBigInt(value: unknown): bigint {
  if (value === undefined || value === null) return 0n;

  if (typeof value === "bigint") return value;

  const raw =
    typeof (value as any)?.toString === "function"
      ? (value as any).toString()
      : String(value);

  if (!raw || raw === "undefined" || raw === "null") return 0n;

  if (raw.includes(".")) {
    return ethers.parseEther(raw);
  }

  return BigInt(raw);
}

function extractLedgerAvailableBalance(ledger: any): bigint {
  const value =
    ledger?.availableBalance ??
    ledger?.ledgerInfo?.availableBalance ??
    ledger?.ledgerInfo?.[1] ??
    ledger?.[1] ??
    ledger?.totalBalance ??
    ledger?.ledgerInfo?.[0] ??
    ledger?.[0];

  return toWeiBigInt(value);
}

async function logOgWalletStatus() {
  const signer = getOgSigner();

  const network = await signer.provider!.getNetwork();
  const nativeBalanceWei = await signer.provider!.getBalance(signer.address);

  console.log("0G wallet:", signer.address);
  console.log("0G chainId:", network.chainId.toString());
  console.log("0G native balance:", ethers.formatEther(nativeBalanceWei));
  console.log("0G RPC:", walletRoastConfig.ogRpcUrl);
  console.log("0G provider:", walletRoastConfig.ogProviderAddress);
}

async function ensureLedgerFunded() {
  const broker = await getOgBroker();

  let ledger: any;

  try {
    ledger = await broker.ledger.getLedger();
  } catch (error: any) {
    const message = String(error?.message || error);

    if (message.toLowerCase().includes("account does not exist")) {
      throw new Error(
        [
          "0G native wallet is funded, but 0G Compute ledger account does not exist.",
          "",
          "Your roast runtime does not create or fund the ledger automatically.",
          "Run the one-time setup script first.",
          "",
          `Wallet provider address from config: ${walletRoastConfig.ogProviderAddress}`,
          `Required ledger minimum: ${walletRoastConfig.ogLedgerFundAmount} OG`,
          "",
          `Original error: ${message}`,
        ].join("\n")
      );
    }

    throw new Error(
      `0G ledger check failed. I did not try to create or fund the ledger. Original error: ${message}`
    );
  }

  const availableBalanceWei = extractLedgerAvailableBalance(ledger);

  const requiredBalanceWei = ethers.parseEther(
    String(walletRoastConfig.ogLedgerFundAmount)
  );

  if (availableBalanceWei < requiredBalanceWei) {
    throw new Error(
      `0G ledger balance is too low. Available: ${ethers.formatEther(
        availableBalanceWei
      )} OG. Required minimum: ${walletRoastConfig.ogLedgerFundAmount} OG.`
    );
  }

  console.log(
    `0G ledger balance OK: ${ethers.formatEther(
      availableBalanceWei
    )} OG available. Minimum required: ${walletRoastConfig.ogLedgerFundAmount} OG.`
  );
}


export async function createOgOpenAIClient(prompt: string) {
  if (!walletRoastConfig.ogProviderAddress) {
    throw new Error("Missing OG_PROVIDER_ADDRESS");
  }

  const broker = await getOgBroker();

  /**
   * Runtime is read-only.
   * It only checks existing wallet + ledger status.
   *
   * It does NOT call:
   * - broker.ledger.addLedger()
   * - broker.ledger.depositFund()
   * - broker.ledger.transferFund()
   */
  await logOgWalletStatus();
  await ensureLedgerFunded();

  const { endpoint, model } = await broker.inference.getServiceMetadata(
    walletRoastConfig.ogProviderAddress
  );

  const rawHeaders = await broker.inference.getRequestHeaders(
    walletRoastConfig.ogProviderAddress,
    prompt
  );

  const defaultHeaders = normalizeHeaders(rawHeaders);

  const openai = new OpenAI({
    baseURL: endpoint,
    apiKey: "unused",
    defaultHeaders,
    maxRetries: 0,
  });

  return {
    broker,
    openai,
    model,
    providerAddress: walletRoastConfig.ogProviderAddress,
  };
}