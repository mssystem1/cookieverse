import { put, list } from "@vercel/blob";
import os from "node:os";
import path from "node:path";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

export type X402Product = "roast-json" | "identity-roast" | "xcup-prophecy";
export type X402Provider =
  | "bankr"
  | "coinbase"
  | "questflow"
  | "mantle-devkit"
  | "cookieverse-mantle"
  | "okx";

export type X402UsageEvent = {
  wallet: `0x${string}`;
  product: X402Product;
  provider: X402Provider;
  chain?: "base" | "mantle" | "xlayer" | "arbitrum";
  endpoint:
    | "cookieverse-roast-json"
    | "cookieverse-identity-roast"
    | "cookieverse-xcup-prophecy";
  requestId: string;
  imageUrl?: string;
  metadataReady?: boolean;
  createdAt: number;
};

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const PREFIX = "fortune-cookie/x402-usage";
const FALLBACK_DIR = path.join(os.tmpdir(), "cookieverse-x402-usage");
const READ_TIMEOUT_MS = 5_000;

function normAddr(address: string) {
  return address.toLowerCase();
}

function usagePath(address: string, createdAt: number, requestId: string) {
  const safeRequestId =
    requestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "req";

  return `${PREFIX}/${normAddr(address)}/v/${createdAt}-${safeRequestId}.json`;
}

async function withTimeout<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("x402 usage storage read timed out")),
          READ_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function listAll(opts: { prefix: string; limit?: number }) {
  if (!TOKEN) return { blobs: [] as any[] };

  const blobs: any[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const res: any = await withTimeout(
      list({
        token: TOKEN,
        prefix: opts.prefix,
        limit: opts.limit ?? 1000,
        cursor
      } as any),
    );

    blobs.push(...(res.blobs ?? []));

    if (!res.cursor) break;

    cursor = res.cursor;
  }

  return { blobs };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  const res = await fetch(url, {
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!res.ok) return null;

  return (await res.json()) as T;
}

export async function recordX402Usage(event: X402UsageEvent) {
  const row = {
    ...event,
    wallet: normAddr(event.wallet) as `0x${string}`,
    createdAt: event.createdAt || Date.now()
  };

  if (!TOKEN) {
    await mkdir(path.join(FALLBACK_DIR, row.wallet), { recursive: true });

    await writeFile(
      path.join(FALLBACK_DIR, row.wallet, `${row.createdAt}-${row.requestId}.json`),
      JSON.stringify(row),
      "utf8"
    );

    return;
  }

  await put(usagePath(row.wallet, row.createdAt, row.requestId), JSON.stringify(row), {
    token: TOKEN,
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: false
  });
}

export async function getX402UsageEvents(address: string): Promise<X402UsageEvent[]> {
  const a = normAddr(address);

  if (!TOKEN) {
    try {
      const dir = path.join(FALLBACK_DIR, a);
      const names = await readdir(dir);

      const rows = await Promise.all(
        names
          .filter((x) => x.endsWith(".json"))
          .map(async (name) => {
            const raw = await readFile(path.join(dir, name), "utf8");
            return JSON.parse(raw) as X402UsageEvent;
          })
      );

      return rows.sort((x, y) => x.createdAt - y.createdAt);
    } catch {
      return [];
    }
  }

  const { blobs } = await listAll({ prefix: `${PREFIX}/${a}/v/` });

  const settled = await Promise.allSettled(
    blobs.map((b: any) => fetchJson<X402UsageEvent>(b.url))
  );
  const rows = settled.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []
  );

  return rows
    .sort((x, y) => x.createdAt - y.createdAt);
}

export async function getX402UsageSummary(address: string) {
  const events = await getX402UsageEvents(address);

  const roastJson = events.filter((e) => e.product === "roast-json").length;
  const identityRoast = events.filter((e) => e.product === "identity-roast").length;
  const xcupProphecy = events.filter((e) => e.product === "xcup-prophecy").length;

  return {
    address: normAddr(address),
    total: events.length,
    roastJson,
    identityRoast,
    xcupProphecy,
    lastUsedAt: events.length ? events[events.length - 1].createdAt : null
  };
}
