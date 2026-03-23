interface CacheEntry {
  receipt: string
  exp: number
}

export class ReceiptCache {
  private readonly entries = new Map<string, CacheEntry>()

  get(path: string): string | null {
    const entry = this.entries.get(path)
    if (!entry) return null
    if (Math.floor(Date.now() / 1000) >= entry.exp) {
      this.entries.delete(path)
      return null
    }
    return entry.receipt
  }

  set(path: string, receipt: string, exp: number): void {
    this.entries.set(path, { receipt, exp })
  }

  clear(): void {
    this.entries.clear()
  }
}
