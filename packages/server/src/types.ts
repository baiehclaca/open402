import type { PaymentInvoice, PaymentOffer, PaymentConfirmation } from '@open402/core'

export interface PaymentAdapter {
  id: string
  currencies: string[]
  createInvoice(offer: PaymentOffer, resource: string): Promise<PaymentInvoice>
  verifyPayment(invoice: PaymentInvoice): Promise<PaymentConfirmation | null>
}

export interface PaywallOptions {
  amount: number
  currency: string
  description?: string
  ttlSeconds?: number
}

export interface PendingInvoice {
  invoice: PaymentInvoice
  status: 'pending' | 'paid' | 'expired'
  receipt?: string
}

export interface ResourcePrice {
  amount: number
  currency: string
  methods: string[]
  description: string
}
