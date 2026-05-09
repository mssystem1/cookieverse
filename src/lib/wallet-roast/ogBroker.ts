/*
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { walletRoastConfig } from "./config";

let walletInstance: ethers.Wallet | null = null;
let brokerPromise: ReturnType<typeof createZGComputeNetworkBroker> | null = null;

export function getOgSigner() {
  if (walletInstance) return walletInstance;

  const provider = new ethers.JsonRpcProvider(walletRoastConfig.ogRpcUrl);
  walletInstance = new ethers.Wallet(walletRoastConfig.ogPrivateKey, provider);
  return walletInstance;
}

export async function getOgBroker() {
  if (!brokerPromise) {
    brokerPromise = createZGComputeNetworkBroker(getOgSigner());
  }
  return brokerPromise;
}
*/

import { ethers } from "ethers";
import {
  createZGComputeNetworkBroker,
  type ZGComputeNetworkBroker,
} from "@0glabs/0g-serving-broker";
import { walletRoastConfig } from "./config";

let walletInstance: ethers.Wallet | null = null;
let brokerPromise: Promise<ZGComputeNetworkBroker> | null = null;

function requireServer() {
  if (typeof window !== "undefined") {
    throw new Error("0G broker must only be used server-side");
  }
}

function normalizePrivateKey(privateKey: string) {
  const trimmed = privateKey.trim();
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

export function getOgSigner() {
  requireServer();

  if (walletInstance) return walletInstance;

  if (!walletRoastConfig.ogRpcUrl) {
    throw new Error("Missing OG RPC URL");
  }

  if (!walletRoastConfig.ogPrivateKey) {
    throw new Error("Missing OG private key");
  }

  const provider = new ethers.JsonRpcProvider(walletRoastConfig.ogRpcUrl);

  walletInstance = new ethers.Wallet(
    normalizePrivateKey(walletRoastConfig.ogPrivateKey),
    provider
  );

  return walletInstance;
}

export async function getOgBroker() {
  requireServer();

  if (!brokerPromise) {
    brokerPromise = createZGComputeNetworkBroker(getOgSigner());
  }

  return brokerPromise;
}