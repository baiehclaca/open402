import type { WalletAdapter } from '@open402/client'
import type { PaymentOffer, PaymentInvoice, PaymentProof } from '@open402/core'
import type { LNDWalletOptions } from './types.js'

export class LNDWallet implements WalletAdapter {
  private readonly opts: LNDWalletOptions

  constructor(opts: LNDWalletOptions) {
    this.opts = opts
  }

  async quote(_offer: PaymentOffer) {
    return null
  }

  async pay(invoice: PaymentInvoice): Promise<PaymentProof> {
    const res = await fetch(`${this.opts.lndRestUrl}/v1/channels/transactions`, {
      method: 'POST',
      headers: {
        'Grpc-Metadata-macaroon': this.opts.macaroon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payment_request: invoice.invoice }),
    })

    if (!res.ok) throw new Error(`LND pay failed: ${res.status}`)

    const data = await res.json() as { payment_preimage: string; payment_error?: string }
    if (data.payment_error) throw new Error(`Payment failed: ${data.payment_error}`)

    return { txid: data.payment_preimage, preimage: data.payment_preimage }
  }

  async getAddress(_currency: string): Promise<string> {
    const res = await fetch(`${this.opts.lndRestUrl}/v1/newaddress`, {
      headers: { 'Grpc-Metadata-macaroon': this.opts.macaroon },
    })
    const data = await res.json() as { address: string }
    return data.address
  }
}
