import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LightningAdapter } from '../lnd-adapter.js'
import type { PaymentOffer } from '@open402/core'

describe('LightningAdapter', () => {
  const opts = { lndRestUrl: 'https://lnd:8080', macaroon: 'deadbeef' }
  let adapter: LightningAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new LightningAdapter(opts)
    expect(adapter.id).toBe('lightning')
    expect(adapter.currencies).toContain('BTC')
  })

  it('creates an invoice via LND REST API', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        payment_request: 'lnbc1000...',
        r_hash: 'aGFzaA==',
        add_index: '1',
      }), { status: 200 })
    )

    const offer: PaymentOffer = {
      amount: 1000,
      currency: 'BTC',
      methods: ['lightning'],
      description: 'test',
      expiry: 9999999999,
      endpoint: '',
    }

    const invoice = await adapter.createInvoice(offer, '/api/data')
    expect(invoice.invoice).toBe('lnbc1000...')
    expect(invoice.method).toBe('lightning')
    expect(invoice.amount).toBe(1000)
    expect(invoice.currency).toBe('BTC')
  })

  it('returns null from verifyPayment when invoice not yet settled', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ settled: false, payment_preimage: '', value: '1000', r_hash: 'aGFzaA==' }), { status: 200 })
    )

    const inv = {
      invoice_id: 'aGFzaA==',
      invoice: 'lnbc1000...',
      amount: 1000,
      currency: 'BTC',
      method: 'lightning',
      resource: '/api/data',
      created_at: 1000,
      expires_at: 9999999999,
    }

    const result = await adapter.verifyPayment(inv)
    expect(result).toBeNull()
  })

  it('returns PaymentConfirmation when invoice is settled', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ settled: true, payment_preimage: 'preimage123', value: '1000', r_hash: 'aGFzaA==' }), { status: 200 })
    )

    const inv = {
      invoice_id: 'aGFzaA==',
      invoice: 'lnbc1000...',
      amount: 1000,
      currency: 'BTC',
      method: 'lightning',
      resource: '/api/data',
      created_at: 1000,
      expires_at: 9999999999,
    }

    const result = await adapter.verifyPayment(inv)
    expect(result).not.toBeNull()
    expect(result!.txid).toBe('preimage123')
    expect(result!.method).toBe('lightning')
  })
})
