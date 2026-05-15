class CacheManager{
  private cache: Map<string, Blob> = new Map();

  public setCache(fileIndex: number, contentIndex: number, data: Blob){
    const key = this.parsekey(fileIndex, contentIndex);

    this.cache.set(key, data);
  }

  public getCache(fileIndex: number, contentIndex: number): Blob | undefined{
    const key = this.parsekey(fileIndex, contentIndex);

    return this.cache.get(key);
  }

  private parsekey(fileIndex: number, contentIndex: number): string{
    return `${fileIndex}_${contentIndex}`;
  }
}

export { CacheManager };