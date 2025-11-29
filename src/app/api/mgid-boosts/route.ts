// src/app/api/mgid-boosts/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChainKey = "monad" | "base" | "mantle" | "linea" | "mitosis";

// Chain IDs
const BOOST_CHAINIDS: Record<ChainKey, number> = {
  monad: 143,
  base: 8453,
  mantle: 5000,
  linea: 59144,
  mitosis: Number(process.env.NEXT_PUBLIC_MITOSIS_CHAIN_ID || 777777),
};

// Boost ERC721 contracts for each chain
const BOOST_CONTRACTS: Record<ChainKey, string | undefined> = {
  monad: process.env.NEXT_PUBLIC_MONADBOOST_ERC721,
  base: process.env.NEXT_PUBLIC_BASEBOOST_ERC721,
  mantle: process.env.NEXT_PUBLIC_MANTLEBOOST_ERC721,
  linea: process.env.NEXT_PUBLIC_LINEABOOST_ERC721,
  mitosis: process.env.NEXT_PUBLIC_MITOSISBOOST_ERC721,
};

// Etherscan API KEY (support both)
const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY ||
  process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY ||
  "";

function isHexAddress(v: string | null): v is `0x${string}` {
  return !!v && /^0x[0-9a-fA-F]{40}$/.test(v);
}

/**
 * Query ERC721 transfers using Etherscan V2 `tokennfttx`
 * Same endpoint format used in fc-token-ids and adapter-sends
 */
async function fetchBoostOnChain(
  chain: ChainKey,
  user: `0x${string}`
): Promise<0 | 1> {
  const apiKey = ETHERSCAN_API_KEY;
  const contract = BOOST_CONTRACTS[chain];
  const chainId = BOOST_CHAINIDS[chain];

  if (!apiKey || !contract) {
    console.warn("[mgid-boosts]", chain, "missing API KEY or boost contract", {
      apiKey: !!apiKey,
      contract,
    });
    return 0;
  }

  const url =
    `https://api.etherscan.io/v2/api` +
    `?chainid=${chainId}` +
    `&module=account` +
    `&action=tokennfttx` +
    `&contractaddress=${contract}` +
    `&address=${user}` + // check transfers involving the user
    `&page=1&offset=10000&sort=asc` +
    `&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[mgid-boosts]", chain, "HTTP error", res.status);
      return 0;
    }

    const json: any = await res.json().catch(() => null);

    if (!json || json.status !== "1" || !Array.isArray(json.result)) {
      console.warn(
        "[mgid-boosts]",
        chain,
        "no result",
        json?.status,
        json?.message
      );
      return 0;
    }

    const transfers = json.result as any[];

    // Does wallet hold the NFT?
    // Holding >0 means it has at least one inbound transfer and no burn.
    // Simplest check: did the NFT ever transfer TO this wallet?
    const holds = transfers.some((tx) => {
      const to = (tx.to || "").toLowerCase();
      const isError = (tx.isError || tx.txreceipt_status || "0").toString();
      return to === user.toLowerCase() && isError === "0";
    });

    return holds ? 1 : 0;
  } catch (e) {
    console.error("[mgid-boosts]", chain, "fetch error", e);
    return 0;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!isHexAddress(address)) {
    return NextResponse.json(
      { error: "Invalid or missing address" },
      { status: 400 }
    );
  }

  const user = address.toLowerCase() as `0x${string}`;

  const [monad, base, mantle, linea, mitosis] = await Promise.all([
    fetchBoostOnChain("monad", user),
    fetchBoostOnChain("base", user),
    fetchBoostOnChain("mantle", user),
    fetchBoostOnChain("linea", user),
    fetchBoostOnChain("mitosis", user),
  ]);

  return NextResponse.json({
    address: user,
    boosts: { monad, base, mantle, linea, mitosis },
  });
}
