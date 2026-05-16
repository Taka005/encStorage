import { Manager } from "./Manager";

class Client{
  private manager: Manager = new Manager();
  private password: string | null = null;

  constructor() {
    this.password = localStorage.getItem("password");
  }

  public get manifestCount(): number {
    return this.manager.ManifestManager.manifestCount;
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

  public getManifest(index: number) {
    return this.manager.getManifest(index);
  }
}

export { Client };