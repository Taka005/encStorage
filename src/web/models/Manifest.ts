import { deriveKey } from "../utils/deriveKey";
import { decryptBuffer } from "../utils/decryptBuffer";
import { hexToUint8 } from "../utils/hexToUnit8";

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

  public get fileCount(): number {
    if (!this.manifestData) throw new Error("Manifest is not decrypted");

    return this.manifestData.length;
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

    manifestData.sort((a, b) => a.originalFileName.localeCompare(b.originalFileName, undefined, {
      numeric: true,
      sensitivity: "base"
    }));

    manifestData.forEach(file => {
      file.files.sort((a, b) => a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base"
      }));
    });

    console.log(`Decrypted manifest at path: ${this.path}, file count: ${manifestData.length}, total content count: ${manifestData.reduce((acc, file) => acc + file.files.length, 0)}`);

    this.manifestData = manifestData;
  }

  public async getContent(fileIndex: number,contentIndex: number): Promise<Blob> {
    if (!this.manifestData) throw new Error("Manifest is not decrypted");

    if(!this.key) throw new Error("Decryption key is not available");

    const fileData = this.manifestData[fileIndex];
    if (!fileData) throw new Error("File index is out of range");

    const contentData = fileData.files[contentIndex];
    if (!contentData) throw new Error("Content index is out of range");

    const imageBuffer = await fetch(`api/download?path=${encodeURIComponent(this.path + "/" + fileData.fileName)}`,{
      headers: { "Range": `bytes=${contentData.start}-${contentData.start + contentData.size - 1}` }
    }).then(res => res.arrayBuffer());

    const iv = hexToUint8(contentData.iv);
    const tag = hexToUint8(contentData.tag);

    const decImage = await decryptBuffer(new Uint8Array(imageBuffer), this.key, iv, tag);

    return new Blob([decImage]);
  }
}

type ManifestJsonType = {
  fileName: string;
  originalFileName: string;
  files: { name: string; start: number; size: number; iv: string; tag: string }[]
}[]

export { Manifest };
export type { ManifestJsonType };