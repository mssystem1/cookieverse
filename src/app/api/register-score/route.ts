/*
// runtime must be node (NOT edge) to use private keys
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  decodeFunctionResult,
  http,
  isAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { monadTestnet } from '../../../lib/chain';
import { savePlayer  } from '../../../server/mgidStore';

const CONTRACT_ADDRESS = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4' as const;

const SCORE_CONTRACT_ABI = [
  {
    type: 'function',
    name: 'updatePlayerData',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'scoreAmount', type: 'uint256' },
      { name: 'transactionAmount', type: 'uint256' }, // we send DELTA (1), contract adds internally
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'totalTransactionsOfPlayer',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: 'count', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalScoreOfPlayer',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: 'score', type: 'uint256' }],
  },
] as const;

function rpcTransport() {
  const url =
    process.env.MONAD_RPC_URL ||
    monadTestnet.rpcUrls?.default?.http?.[0] ||
    'https://rpc.ankr.com/eth';
  return http(url);
}

export async function POST(req: NextRequest) {
  try {
    const { player, scoreAmount } = (await req.json()) as {
      player?: `0x${string}`;
      scoreAmount?: number;
    };

    if (!player || !isAddress(player)) {
      return NextResponse.json({ error: 'Invalid player address' }, { status: 400 });
    }

    const parsedScore =
      typeof scoreAmount === 'number' && Number.isFinite(scoreAmount) && scoreAmount >= 0
        ? Math.floor(scoreAmount)
        : 0;

    const pk = (process.env.SIGNER_PRIVATE_KEY || '').trim();
    if (!pk) {
      return NextResponse.json({ error: 'Missing SIGNER_PRIVATE_KEY' }, { status: 500 });
    }
    const account = privateKeyToAccount(
      pk.startsWith('0x') ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`)
    );

    const publicClient = createPublicClient({ chain: monadTestnet, transport: rpcTransport() });
    const walletClient = createWalletClient({
      chain: monadTestnet,
      transport: rpcTransport(),
      account,
    });

    // Read current totals (no +1)
    const readUint = async (fn: 'totalTransactionsOfPlayer' | 'totalScoreOfPlayer'): Promise<bigint> => {
      const data = encodeFunctionData({ abi: SCORE_CONTRACT_ABI, functionName: fn, args: [player] });
      const res = await publicClient.call({ to: CONTRACT_ADDRESS, data });
      if (!res.data) return 0n;
      return (decodeFunctionResult({ abi: SCORE_CONTRACT_ABI, functionName: fn, data: res.data }) as bigint) || 0n;
    };

    const [currentTxTotal, currentScoreTotal] = await Promise.all([
      readUint('totalTransactionsOfPlayer'),
      readUint('totalScoreOfPlayer'),
    ]);

    // Build & send tx: transactionAmount is a DELTA of +1
    const txDelta = 1n;
    const { request } = await publicClient.simulateContract({
      address: CONTRACT_ADDRESS,
      abi: SCORE_CONTRACT_ABI,
      functionName: 'updatePlayerData',
      args: [player, BigInt(parsedScore), txDelta],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Read NEW totals after write
    const [newTxTotal, newScoreTotal] = await Promise.all([
      readUint('totalTransactionsOfPlayer'),
      readUint('totalScoreOfPlayer'),
    ]);

    // Resolve username from MGID service
    let username = '';
    try {
      const resp = await fetch(
        `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${player}`,
        { method: 'GET', cache: 'no-store' }
      );
      const j = await resp.json();
      username = (j?.hasUsername && j?.user?.username) ? String(j.user.username) : '';
    } catch {
      username = '';
    }

    // Persist for MGID Leaderboard
    await upsertMGIDRecord({
      username: username || `${player.slice(0, 6)}…${player.slice(-4)}`,
      embeddedWallet: player,
      totalScore: Number(newScoreTotal),
      totalTransactions: Number(newTxTotal),
      updatedAt: Date.now(),
    });

// ... after successful on-chain update:
await savePlayer({
      username: username || `${player.slice(0, 6)}…${player.slice(-4)}`,
      embeddedWallet: player,
      totalScore: Number(newScoreTotal),
      totalTransactions: Number(newTxTotal),
      updatedAt: Date.now(),
});

    return NextResponse.json({
      ok: true,
      txHash,
      blockNumber: receipt.blockNumber.toString(),
      player,
      scoreAmount: parsedScore,
      // return new totals (client still re-reads, but this is handy)
      totalTransactions: Number(newTxTotal),
      totalScore: Number(newScoreTotal),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.shortMessage || e?.message || 'Failed to submit score' },
      { status: 500 }
    );
  }
}
*/

export {};
