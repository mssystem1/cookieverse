export type XAuthMode = "V1" | "V2" | "DISABLED";

export function getXAuthMode(): XAuthMode {
  const raw = (process.env.XAUTH || process.env.XUATH || "V2").trim().toUpperCase();

  if (raw === "V1" || raw === "V2" || raw === "DISABLED") {
    return raw;
  }

  console.warn(`[x-auth] Unknown XAUTH/XUATH value "${raw}", falling back to V2.`);
  return "V2";
}

export function isXAuthRequired() {
  return getXAuthMode() !== "DISABLED";
}
