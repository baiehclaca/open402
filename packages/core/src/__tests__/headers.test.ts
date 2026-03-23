import { describe, it, expect } from 'vitest'
import { parsePaymentHeaders, serializePaymentHeaders } from '../headers.js'

describe('parsePaymentHeaders', () => {
  it('parses all required headers from a Headers object', () => {
    const headers = new Headers({
      'payment-amount': '1000',
      'payment-currency': 'BTC',
      'payment-methods': 'lightning, usdc-base',
      'payment-description': 'Access to /api/data',
      'payment-expiry': '1742000000',
      'payment-endpoint': 'https://example.com/.well-known/402/pay',
    })
    const offer = parsePaymentHeaders(headers)
    expect(offer).toEqual({
      amount: 1000,
      currency: 'BTC',
      methods: ['lightning', 'usdc-base'],
      description: 'Access to /api/data',
      expiry: 1742000000,
      endpoint: 'https://example.com/.well-known/402/pay',
    })
  })

  it('returns null when any required header is missing', () => {
    const headers = new Headers({ 'payment-amount': '1000' })
    expect(parsePaymentHeaders(headers)).toBeNull()
  })

  it('parses plain object headers (case-insensitive keys)', () => {
    const raw = {
      'payment-amount': '500',
      'payment-currency': 'USD',
      'payment-methods': 'stripe',
      'payment-description': 'test',
      'payment-expiry': '9999999999',
      'payment-endpoint': 'https://x.com/.well-known/402/pay',
    }
    const offer = parsePaymentHeaders(raw)
    expect(offer?.amount).toBe(500)
    expect(offer?.methods).toEqual(['stripe'])
  })
})

describe('serializePaymentHeaders', () => {
  it('produces correct header key-value pairs', () => {
    const offer = {
      amount: 1000,
      currency: 'BTC',
      methods: ['lightning'],
      description: 'Test',
      expiry: 1742000000,
      endpoint: 'https://x.com/.well-known/402/pay',
    }
    const headers = serializePaymentHeaders(offer)
    expect(headers['Payment-Amount']).toBe('1000')
    expect(headers['Payment-Currency']).toBe('BTC')
    expect(headers['Payment-Methods']).toBe('lightning')
    expect(headers['Payment-Expiry']).toBe('1742000000')
  })
})
