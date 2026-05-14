import { deriveKey } from "../utils/deriveKey";
import { decryptBuffer } from "../utils/decryptBuffer";

class Manifest{
  public path: string;
  public rawData: Uint8Array<ArrayBuffer> | null = null;
  public salt: Uint8Array<ArrayBuffer> | null = null;
  public iv: Uint8Array<ArrayBuffer> | null = null;
  public tag: Uint8Array<ArrayBuffer> | null = null;
  public key: CryptoKey | null = null;
  public manifestData: ManifestJsonType | null = null;

  constructor(path: string) {
    this.path = path;
  }

  public setBuffer(data: Uint8Array<ArrayBuffer>) {
    this.salt = new Uint8Array(data.subarray(0, 16));
    this.iv = new Uint8Array(data.subarray(16, 28));
    this.tag = new Uint8Array(data.subarray(28, 44));
    this.rawData = data.subarray(44);
  }

  public async decryptManifest(password: string): Promise<void> {
    if (!this.rawData || !this.salt || !this.iv || !this.tag) throw new Error("Manifest data is not initialized");

    this.key = await deriveKey(password, this.salt);

    const decData = await decryptBuffer(this.rawData, this.key, this.iv, this.tag);
    const manifestData: ManifestJsonType = JSON.parse(new TextDecoder().decode(decData));

    this.manifestData = manifestData;
  }
}

type ManifestJsonType = {
  fileName: string;
  originalFileName: string;
  files: { name: string; start: number; size: number; iv: string; tag: string }[]
}[]

export { Manifest };
export type { ManifestJsonType };