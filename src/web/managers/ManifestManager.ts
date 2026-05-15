import { Manifest } from "../models/Manifest";

class ManifestManager{
  private manifestList: Manifest[] = [];

  public get manifestCount(): number {
    return this.manifestList.length;
  }

  public setManifestList(paths: string[]): void {
    if (paths.length === 0) throw new Error("No manifest files found");

    this.manifestList = [];

    for (const path of paths) {
      this.manifestList.push(new Manifest(path));
    }
  }

  public async downloadManifest(password: string, index: number): Promise<void> {
    const manifest = this.manifestList[index];
    if (!manifest) throw new Error("Manifest index is out of range");

    if (manifest.manifestData) return;

    const manifestBuffer = await fetch(`api/download?path=${encodeURIComponent(manifest.path)}`)
      .then(res => res.arrayBuffer());

    manifest.setBuffer(new Uint8Array(manifestBuffer));

    return manifest.decryptManifest(password);
  }

  public getManifest(index: number): Manifest {
    const manifest = this.manifestList[index];
    if (!manifest) throw new Error("Manifest index is out of range");

    return manifest;
  }
}

export { ManifestManager };