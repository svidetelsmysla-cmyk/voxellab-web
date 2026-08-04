import type { BrowserPacketV2 } from "../app/contracts";

export function parseBrowserPacketV2(value: unknown): BrowserPacketV2 {
  if (!value || typeof value !== "object") throw new Error("packet: object required");
  const packet = value as Partial<BrowserPacketV2>;
  if (packet.packet_version !== "2.0" || !packet.producer_commit || !packet.verdict || !packet.claim_ceiling) throw new Error("invalid governed packet v2 envelope");
  return structuredClone(packet) as BrowserPacketV2;
}

export const PACKET_AUTHORITY_NOTICE = "Read-only governed packet: browser controls cannot change its verdict or claim ceiling.";

