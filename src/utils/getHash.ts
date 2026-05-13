import crypto from "crypto";

export function getHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}