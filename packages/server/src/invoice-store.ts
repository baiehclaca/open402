import type { PendingInvoice } from './types.js'

export class InvoiceStore {
  private readonly store = new Map<string, PendingInvoice>()

  set(invoiceId: string, entry: PendingInvoice): void {
    this.store.set(invoiceId, { ...entry })
  }

  get(invoiceId: string): PendingInvoice | undefined {
    const entry = this.store.get(invoiceId)
    return entry ? { ...entry } : undefined
  }

  update(invoiceId: string, patch: Partial<PendingInvoice>): void {
    const existing = this.store.get(invoiceId)
    if (!existing) return
    this.store.set(invoiceId, { ...existing, ...patch })
  }

  expireOld(): void {
    const now = Math.floor(Date.now() / 1000)
    for (const [id, entry] of this.store) {
      if (entry.status === 'pending' && entry.invoice.expires_at < now) {
        this.store.set(id, { ...entry, status: 'expired' })
      }
    }
  }
}
