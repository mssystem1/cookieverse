import path from "node:path";
import dotenv from "dotenv";

type EthersLike = {
  parseEther: (value: string) => bigint;
  formatEther: (value: bigint) => string;
};

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function transferProviderFundIfNeeded(
  broker: any,
  ethers: EthersLike,
  providerAddress: string,
  targetAmountOg: number
) {
  console.log("\nEnsuring provider has enough locked inference fund...");
  console.log("Provider:", providerAddress);
  console.log("Target provider fund:", targetAmountOg, "OG");

  /**
   * Simple safe setup approach:
   * transfer exactly OG_PROVIDER_FUND_AMOUNT once when running setup.
   *
   * Why not inside runtime?
   * Because getRequestHeaders can trigger auto-funding txs when provider locked fund is too low.
   */
  const amountWei = ethers.parseEther(String(targetAmountOg));

  try {
    await broker.ledger.transferFund(providerAddress, "inference", amountWei);

    console.log(
      `Transferred ${targetAmountOg} OG to provider inference fund: ${providerAddress}`
    );
  } catch (error: any) {
    const message = String(error?.message || error).toLowerCase();

    if (
      message.includes("socket hang up") ||
      message.includes("econnreset") ||
      String(error?.code || "").toLowerCase().includes("econnreset")
    ) {
      console.warn(
        "RPC connection dropped after provider fund transaction. This may still be mined. Run npm run check:og before retrying."
      );
      return;
    }

    if (
      message.includes("insufficient") ||
      message.includes("not enough") ||
      message.includes("balance")
    ) {
      throw new Error(
        `Not enough available ledger balance to transfer ${targetAmountOg} OG to provider. Original error: ${error?.message || String(error)}`
      );
    }

    throw error;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toWeiBigInt(value: unknown, ethers: any): bigint {
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

function extractLedgerBalances(ledger: any, ethers: any) {
  const totalRaw =
    ledger?.totalBalance ??
    ledger?.ledgerInfo?.totalBalance ??
    ledger?.ledgerInfo?.[1] ??
    ledger?.[1] ??
    ledger?.balance ??
    ledger?.ledgerInfo?.[0] ??
    ledger?.[0];

  const availableRaw =
    ledger?.availableBalance ??
    ledger?.ledgerInfo?.availableBalance ??
    ledger?.ledgerInfo?.[2] ??
    ledger?.[2] ??
    totalRaw;

  return {
    totalWei: toWeiBigInt(totalRaw, ethers),
    availableWei: toWeiBigInt(availableRaw, ethers),
  };
}

function isAccountDoesNotExist(error: unknown) {
  const message = String((error as any)?.message || error).toLowerCase();

  return (
    message.includes("account does not exist") ||
    message.includes("please create an account first")
  );
}

function isRpcConnectionReset(error: unknown) {
  const message = String((error as any)?.message || error).toLowerCase();
  const code = String((error as any)?.code || "").toLowerCase();

  return (
    message.includes("socket hang up") ||
    message.includes("econnreset") ||
    code.includes("econnreset")
  );
}

function isProviderAlreadyAcknowledged(error: unknown) {
  const message = String((error as any)?.message || error).toLowerCase();

  return (
    message.includes("already") ||
    message.includes("acknowledged") ||
    message.includes("known")
  );
}

function isServiceProviderDoesNotExist(error: unknown) {
  const message = String((error as any)?.message || error).toLowerCase();
  const reason = String((error as any)?.reason || "").toLowerCase();

  return (
    message.includes("service provider does not exist") ||
    message.includes("servicenotexist") ||
    reason.includes("servicenotexist")
  );
}

async function printAvailableServices(broker: any) {
  console.log("\nFetching available 0G services from chain...\n");

  const services = await broker.inference.listService();

  if (!services?.length) {
    console.log("No services returned by broker.inference.listService().");
    return;
  }

  console.log("All services:");
  console.dir(services, { depth: null });

  console.log("\nReadable service list:\n");

  for (const service of services) {
    console.log("Provider:", service.provider);
    console.log("Model:", service.model ?? "unknown");
    console.log("Service type:", service.serviceType ?? service.type ?? "unknown");
    console.log("URL:", service.url ?? service.endpoint ?? "unknown");
    console.log("Input price:", service.inputPrice?.toString?.() ?? "unknown");
    console.log("Output price:", service.outputPrice?.toString?.() ?? "unknown");
    console.log("Verifiability:", service.verifiability ?? "unknown");
    console.log("---");
  }
}

async function waitForLedger(broker: any, ethers: any, retries = 20, delayMs = 5000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ledger = await broker.ledger.getLedger();

      console.log("\n0G Compute ledger found:");
      console.dir(ledger, { depth: null });

      const { totalWei, availableWei } = extractLedgerBalances(ledger, ethers);

      console.log("Ledger total:", ethers.formatEther(totalWei), "OG");
      console.log("Ledger available:", ethers.formatEther(availableWei), "OG");

      return ledger;
    } catch (error) {
      if (!isAccountDoesNotExist(error) && !isRpcConnectionReset(error)) {
        throw error;
      }

      console.log(
        `Ledger not visible yet. Retry ${attempt}/${retries} in ${
          delayMs / 1000
        }s...`
      );

      await sleep(delayMs);
    }
  }

  throw new Error("Ledger was not found after waiting.");
}

async function validateProviderExists(
  broker: any,
  providerAddress: string
) {
  try {
    const metadata = await broker.inference.getServiceMetadata(providerAddress);

    console.log("\nProvider exists.");
    console.log("Service metadata:");
    console.dir(metadata, { depth: null });

    return metadata;
  } catch (error) {
    if (isServiceProviderDoesNotExist(error)) {
      console.error("\nConfigured OG_PROVIDER_ADDRESS does not exist:");
      console.error(providerAddress);

      await printAvailableServices(broker);

      throw new Error(
        "Update OG_PROVIDER_ADDRESS in .env.local with a real provider address from the list above, then run setup again."
      );
    }

    throw error;
  }
}

async function acknowledgeProviderWithRetry(
  broker: any,
  providerAddress: string
) {
  console.log("\nAcknowledging provider from config...");
  console.log("Provider:", providerAddress);

  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    console.log("Provider acknowledged:", providerAddress);
    return;
  } catch (error) {
    if (isProviderAlreadyAcknowledged(error)) {
      console.log("Provider already acknowledged:", providerAddress);
      return;
    }

    if (isRpcConnectionReset(error)) {
      console.warn(
        "RPC connection dropped during provider acknowledgement. Waiting and retrying once..."
      );

      await sleep(5000);

      try {
        await broker.inference.acknowledgeProviderSigner(providerAddress);
        console.log("Provider acknowledged after retry:", providerAddress);
        return;
      } catch (retryError) {
        if (isProviderAlreadyAcknowledged(retryError)) {
          console.log("Provider already acknowledged:", providerAddress);
          return;
        }

        throw retryError;
      }
    }

    throw error;
  }
}

async function main() {
  const { ethers } = await import("ethers");

  const { getOgBroker, getOgSigner } = await import(
    "../src/lib/wallet-roast/ogBroker"
  );

  const { walletRoastConfig } = await import(
    "../src/lib/wallet-roast/config"
  );

  if (!walletRoastConfig.ogPrivateKey) {
    throw new Error("Missing OG_PRIVATE_KEY");
  }

  if (!walletRoastConfig.ogRpcUrl) {
    throw new Error("Missing OG_EVM_RPC_URL");
  }

  if (!walletRoastConfig.ogProviderAddress) {
    throw new Error("Missing OG_PROVIDER_ADDRESS");
  }

  if (!walletRoastConfig.ogLedgerFundAmount) {
    throw new Error("Missing OG_LEDGER_FUND_AMOUNT");
  }

  const signer = getOgSigner();
  const broker = await getOgBroker();

  const network = await signer.provider!.getNetwork();
  const nativeBalanceWei = await signer.provider!.getBalance(signer.address);

  console.log("0G wallet:", signer.address);
  console.log("0G chainId:", network.chainId.toString());
  console.log("0G native balance:", ethers.formatEther(nativeBalanceWei));
  console.log("0G RPC:", walletRoastConfig.ogRpcUrl);
  console.log("0G provider:", walletRoastConfig.ogProviderAddress);
  console.log("Ledger amount:", walletRoastConfig.ogLedgerFundAmount, "OG");

  const setupAmountWei = ethers.parseEther(
    String(walletRoastConfig.ogLedgerFundAmount)
  );

  if (nativeBalanceWei < setupAmountWei) {
    console.warn(
      `\nWarning: native wallet balance is lower than OG_LEDGER_FUND_AMOUNT. Native: ${ethers.formatEther(
        nativeBalanceWei
      )} OG, setup amount: ${walletRoastConfig.ogLedgerFundAmount} OG.`
    );
  }

  console.log("\nChecking existing 0G Compute ledger...");

  let ledgerExists = false;
  let ledger: any | null = null;

  try {
    ledger = await broker.ledger.getLedger();
    ledgerExists = true;

    console.log("0G Compute ledger already exists:");
    console.dir(ledger, { depth: null });

    const { totalWei, availableWei } = extractLedgerBalances(ledger, ethers);

    console.log("Ledger total:", ethers.formatEther(totalWei), "OG");
    console.log("Ledger available:", ethers.formatEther(availableWei), "OG");

    if (availableWei < setupAmountWei) {
      console.warn(
        `\nWarning: ledger available balance is below OG_LEDGER_FUND_AMOUNT. Available: ${ethers.formatEther(
          availableWei
        )} OG, required by config: ${walletRoastConfig.ogLedgerFundAmount} OG.`
      );

      console.warn(
        "This script will not top up an existing ledger automatically. Use a separate admin/top-up script if needed."
      );
    }
  } catch (error) {
    if (!isAccountDoesNotExist(error)) {
      throw error;
    }

    console.log("0G Compute ledger does not exist.");
  }

  if (!ledgerExists) {
    console.log(
      `\nCreating 0G Compute ledger with ${walletRoastConfig.ogLedgerFundAmount} OG...`
    );

    try {
      await broker.ledger.addLedger(walletRoastConfig.ogLedgerFundAmount);

      console.log(
        `Created 0G Compute ledger with ${walletRoastConfig.ogLedgerFundAmount} OG`
      );
    } catch (error) {
      if (!isRpcConnectionReset(error)) {
        throw error;
      }

      console.warn(
        "\nRPC connection dropped after broadcasting the addLedger transaction."
      );
      console.warn(
        "This can happen on 0G RPC. Checking if the ledger was created..."
      );
    }

    ledger = await waitForLedger(broker, ethers);
  }

  console.log("\nValidating provider from config...");

  await validateProviderExists(
    broker,
    walletRoastConfig.ogProviderAddress
  );

  await acknowledgeProviderWithRetry(
    broker,
    walletRoastConfig.ogProviderAddress
  );

  await transferProviderFundIfNeeded(
  broker,
  ethers,
  walletRoastConfig.ogProviderAddress,
  walletRoastConfig.ogProviderFundAmount || 2
);

  console.log("\nChecking final ledger...");

  const finalLedger = await broker.ledger.getLedger();
  console.dir(finalLedger, { depth: null });

  const { totalWei, availableWei } = extractLedgerBalances(finalLedger, ethers);

  console.log("Final ledger total:", ethers.formatEther(totalWei), "OG");
  console.log("Final ledger available:", ethers.formatEther(availableWei), "OG");

  console.log("\n0G Compute setup complete.");
}

main().catch((error) => {
  console.error("0G Compute setup failed:");
  console.error(error);
  process.exit(1);
});