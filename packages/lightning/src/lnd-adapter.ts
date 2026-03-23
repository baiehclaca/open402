import type { PaymentAdapter } from '@open402/server'
import type { PaymentOffer, PaymentInvoice, PaymentConfirmation } from '@open402/core'
import type { LNDAdapterOptions, LNDInvoiceResponse, LNDLookupResponse } from './types.js'

export class LightningAdapter implements PaymentAdapter {
  readonly id = 'lightning'
  readonly currencies = ['BTC']
  private readonly opts: LNDAdapterOptions

  constructor(opts: LNDAdapterOptions) {
    this.opts = opts
  }

  async createInvoice(offer: PaymentOffer, resource: string): Promise<PaymentInvoice> {
    const res = await fetch(`${this.opts.lndRestUrl}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Grpc-Metadata-macaroon': this.opts.macaroon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: offer.amount,
        memo: offer.description,
        expiry: 600,
      }),
    })

    if (!res.ok) throw new Error(`LND createInvoice failed: ${res.status}`)

    const data = await res.json() as LNDInvoiceResponse
    const now = Math.floor(Date.now() / 1000)

    return {
      invoice_id: data.r_hash,
      invoice: data.payment_request,
      amount: offer.amount,
      currency: 'BTC',
      method: 'lightning',
      resource,
      created_at: now,
      expires_at: now + 600,
    }
  }

  async verifyPayment(invoice: PaymentInvoice): Promise<PaymentConfirmation | null> {
    const res = await fetch(
      `${this.opts.lndRestUrl}/v1/invoice/${encodeURIComponent(invoice.invoice_id)}`,
      {
        headers: { 'Grpc-Metadata-macaroon': this.opts.macaroon },
      },
    )

    if (!res.ok) return null

    const data = await res.json() as LNDLookupResponse
    if (!data.settled) return null

    return {
      txid: data.payment_preimage,
      method: 'lightning',
      amount: parseInt(data.value, 10),
      currency: 'BTC',
    }
  }
}
