export type PinataPinResult = {
  cid: string;
  ipfsUri: string;
  gatewayUrl: string;
};

function gatewayBase() {
  return (process.env.PINATA_GATEWAY || "https://ipfs.io/ipfs/").replace(/\/+$/, "") + "/";
}

function toArrayBuffer(input: Buffer | Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(input.byteLength);
  const view = new Uint8Array(arrayBuffer);

  view.set(input);

  return arrayBuffer;
}

export async function pinPngBufferToPinata(
  buffer: Buffer | Uint8Array,
  filename = "cookieverse-wallet-roast.png"
): Promise<PinataPinResult> {
  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    throw new Error("Missing PINATA_JWT");
  }

  const arrayBuffer = toArrayBuffer(buffer);

  const fd = new FormData();

  fd.append(
    "file",
    new Blob([arrayBuffer], { type: "image/png" }),
    filename
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Pinata error: ${res.status} ${txt}`);
  }

  const json = await res.json();

  const cid = json.IpfsHash || json.cid || json.Hash;

  if (!cid) {
    throw new Error("Pinata returned no CID");
  }

  return {
    cid,
    ipfsUri: `ipfs://${cid}`,
    gatewayUrl: `${gatewayBase()}${cid}`,
  };
}