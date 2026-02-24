import crypto from "node:crypto";
import type { SyncSnapshotEnvelope } from "./syncStore";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(",")}}`;
}

function getSignatureSecret(): string | null {
  const secret = process.env.SYNC_SNAPSHOT_HMAC_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

export function signSyncSnapshot(snapshot: SyncSnapshotEnvelope): string | null {
  const secret = getSignatureSecret();
  if (!secret) return null;
  const body = stableStringify({
    version: snapshot.version,
    exportedAt: snapshot.exportedAt,
    data: snapshot.data,
  });
  return crypto.createHmac("sha256", secret).update(body).digest("base64url");
}

export function verifySyncSnapshotSignature(snapshot: SyncSnapshotEnvelope): boolean {
  const secret = getSignatureSecret();
  if (!secret) return true;
  if (!snapshot.signature || typeof snapshot.signature !== "string") return false;
  const expected = signSyncSnapshot({ ...snapshot, signature: undefined }) ?? "";
  return (
    expected.length === snapshot.signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(snapshot.signature))
  );
}
