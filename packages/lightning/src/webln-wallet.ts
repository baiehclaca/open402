import type { WalletAdapter } from '@open402/client'
import type { PaymentOffer, PaymentInvoice, PaymentProof } from '@open402/core'

interface WebLN {
  sendPayment(paymentRequest: string): Promise<{ preimage: string }>
  getInfo(): Promise<{ node: { identity_pubkey: string } }>
  enable(): Promise<void>
}

declare global {
  interface Window { webln?: WebLN }
}

export class WebLNWallet implements WalletAdapter {
  private webln: WebLN | null = null

  private async getWebLN(): Promise<WebLN> {
    if (this.webln) return this.webln
    const w = (typeof window !== 'undefined' && window.webln) ? window.webln : null
    if (!w) throw new Error('WebLN not available. Install Alby or another WebLN provider.')
    await w.enable()
    this.webln = w
    return w
  }

  async quote(_offer: PaymentOffer) {
    return null
  }

  async pay(invoice: PaymentInvoice): Promise<PaymentProof> {
    const webln = await this.getWebLN()
    const result = await webln.sendPayment(invoice.invoice)
    return { txid: result.preimage, preimage: result.preimage }
  }

  async getAddress(_currency: string): Promise<string> {
    const webln = await this.getWebLN()
    const info = await webln.getInfo()
    return info.node.identity_pubkey
  }
}
