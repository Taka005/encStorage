import { Manifest } from "../models/Manifest";

class ManifestManager{
  public manifestList: Manifest[] = [];

  constructor(paths: string[]) {
    for (const path of paths) {
      this.manifestList.push(new Manifest(path));
    }
  }

  public async downloadManifest(password: string, index: number): Promise<void> {
    const manifest = this.manifestList[index];
    if (!manifest) throw new Error("Manifest index is out of range");

    const manifestBuffer = await fetch(`api/download.php?path=${encodeURIComponent(manifest.path)}`)
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