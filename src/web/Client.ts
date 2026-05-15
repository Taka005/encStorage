import { Manager } from "./Manager";

class Client{
  private manager: Manager = new Manager();
  private password: string | null = null;
  public currentManifestIndex: number = 0;
  public currentFileIndex: number = 0;

  constructor() {
    this.password = localStorage.getItem("password");
  }

  public get isPasswordSet(): boolean {
    return this.password !== null;
  }

  public async load(): Promise<void> {
    if (!this.password) throw new Error("Password is not set");

    await this.manager.downLoadLink();

    for (let i = 0; i < this.manager.ManifestManager.manifestCount; i++) {
      await this.manager.ManifestManager.downloadManifest(this.password, i);
    }
  }

  public setPassword(password: string): void {
    this.password = password;

    localStorage.setItem("password", password);
  }

  public getContent(): Promise<Blob> {
    return this.manager.getContent(this.currentManifestIndex, this.currentFileIndex, 0);
  }
}

export { Client };