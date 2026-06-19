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
    return this.manifestData.files.length;
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
    manifestData.files.sort((a, b) => a.originalFileName.localeCompare(b.originalFileName, undefined, {
      numeric: true,
      sensitivity: "base"
    }));
    manifestData.files.forEach((file) => {
      file.files.sort((a, b) => a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base"
      }));
    });
    console.log(`Decrypted manifest at path: ${this.path}, file count: ${manifestData.files.length}, total content count: ${manifestData.files.reduce((acc, file) => acc + file.files.length, 0)}`);
    this.manifestData = manifestData;
  }
  async getContent(fileIndex, contentIndex) {
    if (!this.manifestData)
      throw new Error("Manifest is not decrypted");
    if (!this.key)
      throw new Error("Decryption key is not available");
    const fileData = this.manifestData.files[fileIndex];
    if (!fileData)
      throw new Error("File index is out of range");
    const contentData = fileData.files[contentIndex];
    if (!contentData)
      throw new Error("Content index is out of range");
    const imageBuffer = await fetch(`api/download?path=${encodeURIComponent(this.path + "/" + fileData.fileName)}`, {
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
    const manifestBuffer = await fetch(`api/download?path=${encodeURIComponent(manifest.path + "/manifest")}`).then((res) => res.arrayBuffer());
    console.log(`Downloaded manifest from path: ${manifest.path}, size: ${manifestBuffer.byteLength} bytes`);
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
  async downLoadLink() {
    const manifestLinks = await fetch("api/manifest").then((res) => res.json());
    if (manifestLinks.length === 0)
      throw new Error("No manifest files found");
    console.log(`Found ${manifestLinks.length} manifest files`);
    this.ManifestManager.setManifestList(manifestLinks);
  }
  getManifest(index) {
    if (this.ManifestManager.manifestCount === 0)
      throw new Error("Manifest manager is not initialized");
    return this.ManifestManager.getManifest(index);
  }
  async getContent(manifestIndex, fileIndex, contentIndex) {
    const manifest = this.getManifest(manifestIndex);
    console.log(`Getting content for manifestIndex: ${manifestIndex}, fileIndex: ${fileIndex}, contentIndex: ${contentIndex}`);
    const cahceContent = this.CacheManager.getCache(fileIndex, contentIndex);
    if (cahceContent) {
      return cahceContent;
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
  constructor() {
    this.password = localStorage.getItem("password");
  }
  get manifestCount() {
    return this.manager.ManifestManager.manifestCount;
  }
  get isPasswordSet() {
    return this.password !== null;
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
  getManifest(index) {
    return this.manager.getManifest(index);
  }
}

// src/web/reader.ts
var params = new URLSearchParams(document.location.search);
var viewer = document.getElementById("imageViewer");
var container = document.querySelector(".viewer-container");
(async () => {
  const client = new Client;
  const loadedImages = new Map;
  if (!client.isPasswordSet) {
    const passwordInput = prompt("Enter password:");
    if (!passwordInput) {
      alert("Password is required to load content");
      return;
    }
    client.setPassword(passwordInput);
  }
  if (!client.isPasswordSet) {
    alert("Password is required to load content");
    return;
  }
  try {
    await client.load();
  } catch (e) {
    alert("Failed to load content: " + e);
    return;
  }
  const indexParam = params.get("manifestIndex");
  const fileIndexParam = params.get("fileIndex");
  const manifestIndex = indexParam ? parseInt(indexParam) : null;
  const fileIndex = fileIndexParam ? parseInt(fileIndexParam) : null;
  if (manifestIndex === null || manifestIndex < 0 || manifestIndex >= client.manifestCount) {
    alert("Invalid manifest index");
    window.location.href = "index.html";
    return;
  }
  const manifest = client.getManifest(manifestIndex);
  if (fileIndex === null || fileIndex < 0 || fileIndex >= manifest.fileCount) {
    alert("Invalid file index");
    window.location.href = `index.html?manifestIndex=${manifestIndex}`;
    return;
  }
  let contentIndex = 0;
  let currentId = 0;
  if (!manifest.manifestData) {
    alert("Manifest is not decrypted");
    window.location.href = "index.html";
    return;
  }
  const fileData = manifest.manifestData.files[fileIndex];
  if (!fileData) {
    alert("File index is out of range");
    window.location.href = `index.html?manifestIndex=${manifestIndex}`;
    return;
  }
  const placeholders = [];
  for (let i = 0;i < fileData.files.length; i++) {
    const box = document.createElement("div");
    box.className = "viewer-img-box";
    viewer.appendChild(box);
    placeholders.push(box);
  }
  container.addEventListener("scroll", () => {
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    if (width === 0)
      return;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== contentIndex) {
      contentIndex = newIndex;
      updateImages(manifest, fileData.files.length, fileIndex, contentIndex);
    }
  });
  await updateImages(manifest, fileData.files.length, fileIndex, contentIndex);
  async function updateImages(manifest2, contentCount, fileIndex2, targetIndex) {
    const myId = ++currentId;
    const start = Math.max(0, targetIndex - 3);
    const end = Math.min(contentCount - 1, targetIndex + 3);
    for (let i = start;i <= end; i++) {
      if (!loadedImages.has(i)) {
        const content = await manifest2.getContent(fileIndex2, i);
        if (myId !== currentId)
          return;
        const url = URL.createObjectURL(content);
        const imgTag = document.createElement("img");
        imgTag.src = url;
        console.log(`Loaded content for fileIndex: ${fileIndex2}, contentIndex: ${i}, size: ${content.size} bytes`);
        const placeholder = placeholders[i];
        if (placeholder) {
          placeholder.appendChild(imgTag);
          loadedImages.set(i, imgTag);
        }
      }
    }
    for (const [index, imgElement] of loadedImages.entries()) {
      if (index < targetIndex - 3 || index > targetIndex + 3) {
        URL.revokeObjectURL(imgElement.src);
        imgElement.remove();
        loadedImages.delete(index);
      }
    }
  }
})();
