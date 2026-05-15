import { ManifestManager } from "./managers/ManifestManager";
import { CacheManager } from "./managers/CacheManager";

class Manager{
  public ManifestManager: ManifestManager = new ManifestManager();
  private CacheManager: CacheManager = new CacheManager();

  constructor() {
    this.downLoadLink();
  }

  public async downLoadLink(): Promise<void> {
    const manifestLinks = await fetch("api/manifest")
      .then(res => res.json());
    
    if(manifestLinks.length === 0) throw new Error("No manifest files found");

    this.ManifestManager.setManifestList(manifestLinks);
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

export { Manager };