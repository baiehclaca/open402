import { parsePaymentHeaders } from '@open402/core'
import { ReceiptCache } from './receipt-cache.js'
import type { Open402ClientOptions } from './types.js'

export class Open402Client {
  private readonly wallet: Open402ClientOptions['wallet']
  private readonly pollIntervalMs: number
  private readonly maxPollAttempts: number
  private readonly receiptCache = new ReceiptCache()

  constructor(options: Open402ClientOptions) {
    this.wallet = options.wallet
    this.pollIntervalMs = options.pollIntervalMs ?? 2000
    this.maxPollAttempts = options.maxPollAttempts ?? 30
  }

  async fetch(input: string, init?: RequestInit): Promise<Response> {
    const url = new URL(input)
    const path = url.pathname

    const cached = this.receiptCache.get(path)
    if (cached) {
      return this.requestWithReceipt(input, init, cached)
    }

    const res = await globalThis.fetch(input, init)

    if (res.status !== 402) return res

    const offer = parsePaymentHeaders(res.headers)
    if (!offer) throw new Error('402 response missing payment headers')

    const createRes = await globalThis.fetch(offer.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: offer.methods[0],
        currency: offer.currency,
        resource: path,
      }),
    })

    if (!createRes.ok) throw new Error(`Failed to create invoice: ${createRes.status}`)

    const { invoice_id, invoice } = await createRes.json() as { invoice_id: string; invoice: string }

    await this.wallet.pay({
      invoice_id,
      invoice,
      amount: offer.amount,
      currency: offer.currency,
      method: offer.methods[0] ?? 'lightning',
      resource: path,
      created_at: Math.floor(Date.now() / 1000),
      expires_at: offer.expiry,
    })

    const receipt = await this.pollForReceipt(offer.endpoint, invoice_id)

    const exp = this.parseJwtExp(receipt)
    this.receiptCache.set(path, receipt, exp)

    return this.requestWithReceipt(input, init, receipt)
  }

  private async requestWithReceipt(
    input: string,
    init: RequestInit | undefined,
    receipt: string,
  ): Promise<Response> {
    const base = new Headers(init?.headers)
    const headers: Record<string, string> = {}
    base.forEach((value, key) => { headers[key] = value })
    headers['Payment-Receipt'] = receipt
    return globalThis.fetch(input, { ...init, headers })
  }

  private parseJwtExp(jwt: string): number {
    try {
      const payload = jwt.split('.')[1] ?? ''
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { exp?: number }
      return decoded.exp ?? Math.floor(Date.now() / 1000) + 3600
    } catch {
      return Math.floor(Date.now() / 1000) + 3600
    }
  }

  private async pollForReceipt(endpoint: string, invoiceId: string): Promise<string> {
    const pollUrl = `${endpoint}/${invoiceId}`

    for (let i = 0; i < this.maxPollAttempts; i++) {
      if (i > 0 && this.pollIntervalMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs))
      }

      const res = await globalThis.fetch(pollUrl)
      const body = await res.json() as { status: string; receipt?: string }

      if (body.status === 'paid' && body.receipt) return body.receipt
      if (body.status === 'expired') throw new Error('Invoice expired before payment')
    }

    throw new Error('Payment polling timed out')
  }
}
