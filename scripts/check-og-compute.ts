import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

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
  console.log(
    "Required ledger minimum:",
    walletRoastConfig.ogLedgerFundAmount,
    "OG"
  );

  console.log("\nChecking ledger only...");

  const ledger = await broker.ledger.getLedger();

  console.log("Ledger exists:");
  console.dir(ledger, { depth: null });

  const { totalWei, availableWei } = extractLedgerBalances(ledger, ethers);

  const requiredLedgerWei = ethers.parseEther(
    String(walletRoastConfig.ogLedgerFundAmount)
  );

  console.log("\nParsed ledger balances:");
  console.log("Ledger total:", ethers.formatEther(totalWei), "OG");
  console.log("Ledger available:", ethers.formatEther(availableWei), "OG");

  if (availableWei < requiredLedgerWei) {
    throw new Error(
      `0G ledger balance is too low. Available: ${ethers.formatEther(
        availableWei
      )} OG. Required minimum: ${walletRoastConfig.ogLedgerFundAmount} OG.`
    );
  }

  console.log("\nLedger balance OK.");

  console.log("\nChecking service metadata...");

  try {
    const metadata = await broker.inference.getServiceMetadata(
      walletRoastConfig.ogProviderAddress
    );

    console.log("Service metadata:");
    console.dir(metadata, { depth: null });
  } catch (error) {
    if (isServiceProviderDoesNotExist(error)) {
      console.error("\nConfigured OG_PROVIDER_ADDRESS does not exist:");
      console.error(walletRoastConfig.ogProviderAddress);

      await printAvailableServices(broker);

      throw new Error(
        "Update OG_PROVIDER_ADDRESS in .env.local with a real provider address from the list above."
      );
    }

    throw error;
  }

  console.log("\nRead-only 0G check complete.");
}

main().catch((error) => {
  console.error("Read-only 0G check failed:");
  console.error(error);
  process.exit(1);
});