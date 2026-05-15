// src/web/utils/deriveKey.ts
var deriveKey = async (password, salt) => {
  const enc = new TextEncoder;
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 1e5, hash: "SHA-256" }, baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
};

// src/web/utils/decryptBuffer.ts
var decryptBuffer = async (data, key, iv, tag) => {
  const combined = new Uint8Array(data.byteLength + tag.byteLength);
  combined.set(new Uint8Array(data), 0);
  combined.set(tag, data.byteLength);
  return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
};

// src/web/utils/hexToUnit8.ts
var hexToUint8 = (hex) => {
  const match = hex.match(/.{1,2}/g);
  if (!match)
    throw new Error("Invalid hex string");
  return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
};

// src/web/models/Manifest.ts
class Manifest {
  path;
  rawData = null;
  salt = null;
  iv = null;
  tag = null;
  key = null;
  manifestData = null;
  constructor(path) {
    this.path = path;
  }
  get fileCount() {
    if (!this.manifestData)
      throw new Error("Manifest is not decrypted");
    return this.manifestData.length;
  }
  setBuffer(data) {
    this.salt = new Uint8Array(data.subarray(0, 16));
    this.iv = new Uint8Array(data.subarray(16, 28));
    this.tag = new Uint8Array(data.subarray(28, 44));
    this.rawData = data.subarray(44);
  }
  async decryptManifest(password) {
    if (!this.rawData || !this.salt || !this.iv || !this.tag)
      throw new Error("Manifest data is not initialized");
    this.key = await deriveKey(password, this.salt);
    const decData = await decryptBuffer(this.rawData, this.key, this.iv, this.tag);
    const manifestData = JSON.parse(new TextDecoder().decode(decData));
    manifestData.sort((a, b) => a.originalFileName.localeCompare(b.originalFileName, undefined, {
      numeric: true,
      sensitivity: "base"
    }));
    manifestData.forEach((file) => {
      file.files.sort((a, b) => a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base"
      }));
    });
    this.manifestData = manifestData;
  }
  async getContent(fileIndex, contentIndex) {
    if (!this.manifestData)
      throw new Error("Manifest is not decrypted");
    if (!this.key)
      throw new Error("Decryption key is not available");
    const fileData = this.manifestData[fileIndex];
    if (!fileData)
      throw new Error("File index is out of range");
    const contentData = fileData.files[contentIndex];
    if (!contentData)
      throw new Error("Content index is out of range");
    const targetPath = this.path.replace("manifest", "");
    const imageBuffer = await fetch(`api/download?path=${encodeURIComponent(targetPath + fileData.fileName)}`, {
      headers: { Range: `bytes=${contentData.start}-${contentData.start + contentData.size - 1}` }
    }).then((res) => res.arrayBuffer());
    const iv = hexToUint8(contentData.iv);
    const tag = hexToUint8(contentData.tag);
    const decImage = await decryptBuffer(new Uint8Array(imageBuffer), this.key, iv, tag);
    return new Blob([decImage]);
  }
}

// src/web/managers/ManifestManager.ts
class ManifestManager {
  manifestList = [];
  get manifestCount() {
    return this.manifestList.length;
  }
  setManifestList(paths) {
    if (paths.length === 0)
      throw new Error("No manifest files found");
    this.manifestList = [];
    for (const path of paths) {
      this.manifestList.push(new Manifest(path));
    }
  }
  async downloadManifest(password, index) {
    const manifest = this.manifestList[index];
    if (!manifest)
      throw new Error("Manifest index is out of range");
    if (manifest.manifestData)
      return;
    const manifestBuffer = await fetch(`api/download?path=${encodeURIComponent(manifest.path)}`).then((res) => res.arrayBuffer());
    manifest.setBuffer(new Uint8Array(manifestBuffer));
    return manifest.decryptManifest(password);
  }
  getManifest(index) {
    const manifest = this.manifestList[index];
    if (!manifest)
      throw new Error("Manifest index is out of range");
    return manifest;
  }
}

// src/web/managers/CacheManager.ts
class CacheManager {
  cache = new Map;
  setCache(fileIndex, contentIndex, data) {
    const key = this.parsekey(fileIndex, contentIndex);
    this.cache.set(key, data);
  }
  isCached(fileIndex, contentIndex) {
    const key = this.parsekey(fileIndex, contentIndex);
    return this.cache.has(key);
  }
  getCache(fileIndex, contentIndex) {
    const key = this.parsekey(fileIndex, contentIndex);
    return this.cache.get(key);
  }
  parsekey(fileIndex, contentIndex) {
    return `${fileIndex}_${contentIndex}`;
  }
}

// src/web/Manager.ts
class Manager {
  ManifestManager = new ManifestManager;
  CacheManager = new CacheManager;
  constructor() {
    this.downLoadLink();
  }
  async downLoadLink() {
    const manifestLinks = await fetch("api/manifest").then((res) => res.json());
    if (manifestLinks.length === 0)
      throw new Error("No manifest files found");
    this.ManifestManager.setManifestList(manifestLinks);
  }
  getManifest(index) {
    if (!this.ManifestManager)
      throw new Error("Manifest manager is not initialized");
    return this.ManifestManager.getManifest(index);
  }
  async getContent(manifestIndex, fileIndex, contentIndex) {
    const manifest = this.getManifest(manifestIndex);
    if (this.CacheManager.isCached(fileIndex, contentIndex)) {
      const content = this.CacheManager.getCache(fileIndex, contentIndex);
      if (!content)
        throw new Error("Cached content is undefined");
      return content;
    } else {
      const content = await manifest.getContent(fileIndex, contentIndex);
      this.CacheManager.setCache(fileIndex, contentIndex, content);
      return content;
    }
  }
}

// src/web/Client.ts
class Client {
  manager = new Manager;
  password = null;
  currentManifestIndex = 0;
  currentFileIndex = 0;
  constructor() {
    this.password = localStorage.getItem("password");
  }
  async load() {
    if (!this.password)
      throw new Error("Password is not set");
    await this.manager.downLoadLink();
    for (let i = 0;i < this.manager.ManifestManager.manifestCount; i++) {
      await this.manager.ManifestManager.downloadManifest(this.password, i);
    }
  }
  setPassword(password) {
    this.password = password;
    localStorage.setItem("password", password);
  }
}

// src/web/index.ts
var client = new Client;
var passwordInput = prompt("Enter password:");
if (passwordInput) {
  client.setPassword(passwordInput);
  client.load().catch((err) => {
    alert("Error loading manifests: " + err.message);
  });
}
