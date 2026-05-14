import crypto from "crypto";

export const getHash = (text: string): string => {
  return crypto.createHash("sha256").update(text).digest("hex");
};