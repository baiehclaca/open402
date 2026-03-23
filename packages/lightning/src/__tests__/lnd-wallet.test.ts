import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LNDWallet } from '../lnd-wallet.js'

describe('LNDWallet', () => {
  const opts = { lndRestUrl: 'https://lnd:8080', macaroon: 'deadbeef' }
  let wallet: LNDWallet

  beforeEach(() => {
    vi.restoreAllMocks()
    wallet = new LNDWallet(opts)
  })

  it('pays an invoice via LND REST and returns preimage', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ payment_preimage: 'preimage456', payment_error: '' }), { status: 200 })
    )
    const proof = await wallet.pay({
      invoice_id: 'inv_1', invoice: 'lnbc1000...',
      amount: 1000, currency: 'BTC', method: 'lightning',
      resource: '/api/data', created_at: 1000, expires_at: 2000,
    })
    expect(proof.txid).toBe('preimage456')
  })

  it('throws when LND returns a payment_error', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ payment_preimage: '', payment_error: 'insufficient balance' }), { status: 200 })
    )
    await expect(wallet.pay({
      invoice_id: 'inv_1', invoice: 'lnbc1000...',
      amount: 1000, currency: 'BTC', method: 'lightning',
      resource: '/api/data', created_at: 1000, expires_at: 2000,
    })).rejects.toThrow('insufficient balance')
  })

  it('returns null from quote', async () => {
    const q = await wallet.quote({ amount: 1000, currency: 'BTC', methods: ['lightning'], description: '', expiry: 0, endpoint: '' })
    expect(q).toBeNull()
  })
})
