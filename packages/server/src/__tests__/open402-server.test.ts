import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Open402Server } from '../open402-server.js'
import type { PaymentAdapter } from '../types.js'
import type { PaymentInvoice, PaymentOffer } from '@open402/core'

const mockAdapter: PaymentAdapter = {
  id: 'lightning',
  currencies: ['BTC'],
  createInvoice: vi.fn(async (_offer: PaymentOffer, resource: string): Promise<PaymentInvoice> => ({
    invoice_id: 'inv_test',
    invoice: 'lnbc1000...',
    amount: _offer.amount,
    currency: _offer.currency,
    method: 'lightning',
    resource,
    created_at: Math.floor(Date.now() / 1000),
    expires_at: Math.floor(Date.now() / 1000) + 600,
  })),
  verifyPayment: vi.fn(async () => null),
}

describe('Open402Server', () => {
  let server: Open402Server

  beforeEach(async () => {
    server = new Open402Server()
    await server.init()
    server.registerAdapter(mockAdapter)
  })

  it('reports supported methods from registered adapters', () => {
    expect(server.getSupportedMethods()).toContain('lightning')
  })

  it('reports supported currencies from registered adapters', () => {
    expect(server.getSupportedCurrencies()).toContain('BTC')
  })

  it('creates an invoice via registered adapter', async () => {
    server.registerPrice('/api/data', { amount: 1000, currency: 'BTC', methods: ['lightning'], description: 'test' })
    const result = await server.createInvoice('lightning', '/api/data')
    expect(result.invoice_id).toBe('inv_test')
    expect(result.invoice).toBe('lnbc1000...')
  })

  it('throws when creating invoice for unknown method', async () => {
    server.registerPrice('/api/data', { amount: 1000, currency: 'BTC', methods: ['lightning'], description: 'test' })
    await expect(server.createInvoice('stripe', '/api/data')).rejects.toThrow()
  })

  it('returns not_found when polling unknown invoice', async () => {
    const result = await server.pollInvoice('nonexistent')
    expect(result.status).toBe('not_found')
  })

  it('verifies a receipt it signed', async () => {
    const valid = await server.signTestReceipt('/api/data')
    expect(await server.verifyReceiptJwt(valid)).toBe(true)
  })
})
