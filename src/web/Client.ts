import { ManifestManager } from "./managers/ManifestManager";
import { CacheManager } from "./managers/CacheManager";

class Client{
  private ManifestManager: ManifestManager | null = null;
  private CacheManager: CacheManager = new CacheManager();
  private password: string | null = null;

  constructor() {
    this.password = localStorage.getItem("password");
    this.downLoadLink();
  }

  public async downLoadLink(): Promise<void> {
    const manifestLinks = await fetch("api/manifest")
      .then(res => res.json());
    
    if(manifestLinks.length === 0) throw new Error("No manifest files found");

    this.ManifestManager = new ManifestManager(manifestLinks);
  }

  public setPassword(password: string): void {
    this.password = password;

    localStorage.setItem("password", password);
  }

  public async loadManifest(index: number): Promise<void> {
    if (!this.ManifestManager) throw new Error("Manifest manager is not initialized");
    if (!this.password) throw new Error("Password is not set");

    await this.ManifestManager.downloadManifest(this.password, index);
  }

  public getManifest(index: number) {
    if (!this.ManifestManager) throw new Error("Manifest manager is not initialized");

    return this.ManifestManager.getManifest(index);
  }

  public async getContent(manifestIndex: number, fileIndex: number, contentIndex: number): Promise<Blob> {
    const manifest = this.getManifest(manifestIndex);

    if (this.CacheManager.isCached(fileIndex, contentIndex)) {
      const content = this.CacheManager.getCache(fileIndex, contentIndex);
      if (!content) throw new Error("Cached content is undefined");

      return content;
    }else{
      const content = await manifest.getContent(fileIndex, contentIndex);

      this.CacheManager.setCache(fileIndex, contentIndex, content);

      return content;
    }
  }
}

export { Client };