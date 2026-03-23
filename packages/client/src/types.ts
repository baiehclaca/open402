import type { PaymentOffer, PaymentInvoice, PaymentProof, PaymentQuote } from '@open402/core'

export interface WalletAdapter {
  quote(offer: PaymentOffer): Promise<PaymentQuote | null>
  pay(invoice: PaymentInvoice): Promise<PaymentProof>
  getAddress(currency: string): Promise<string>
}

export interface Open402ClientOptions {
  wallet: WalletAdapter
  pollIntervalMs?: number   // default 2000
  maxPollAttempts?: number  // default 30 (60 seconds)
}
