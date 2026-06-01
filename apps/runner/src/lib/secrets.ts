import crypto from "node:crypto";
import { env } from "./config.js";

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

export function decryptSecret(cipherText: string): string {
  const [ivHex, encryptedHex] = cipherText.split(":");
  if (!ivHex || !encryptedHex) throw new Error("Invalid encrypted secret format");

  const key = deriveKey(env.TEST_ACCOUNT_ENCRYPTION_KEY);
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}
