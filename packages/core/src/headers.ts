import type { PaymentOffer } from './types.js'

type RawHeaders = Headers | Record<string, string>

function getHeader(headers: RawHeaders, key: string): string | null {
  if (headers instanceof Headers) return headers.get(key)
  return (headers as Record<string, string>)[key.toLowerCase()] ??
         (headers as Record<string, string>)[key] ??
         null
}

export function parsePaymentHeaders(headers: RawHeaders): PaymentOffer | null {
  const amount    = getHeader(headers, 'payment-amount')
  const currency  = getHeader(headers, 'payment-currency')
  const methods   = getHeader(headers, 'payment-methods')
  const desc      = getHeader(headers, 'payment-description')
  const expiry    = getHeader(headers, 'payment-expiry')
  const endpoint  = getHeader(headers, 'payment-endpoint')

  if (!amount || !currency || !methods || !desc || !expiry || !endpoint) return null

  return {
    amount: parseInt(amount, 10),
    currency,
    methods: methods.split(',').map(m => m.trim()),
    description: desc,
    expiry: parseInt(expiry, 10),
    endpoint,
  }
}

export function serializePaymentHeaders(offer: PaymentOffer): Record<string, string> {
  return {
    'Payment-Amount':      String(offer.amount),
    'Payment-Currency':    offer.currency,
    'Payment-Methods':     offer.methods.join(', '),
    'Payment-Description': offer.description,
    'Payment-Expiry':      String(offer.expiry),
    'Payment-Endpoint':    offer.endpoint,
  }
}
