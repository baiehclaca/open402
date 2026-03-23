import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebLNWallet } from '../webln-wallet.js'

const mockWebLN = {
  enable: vi.fn(async () => {}),
  sendPayment: vi.fn(async () => ({ preimage: 'preimage123' })),
  getInfo: vi.fn(async () => ({ node: { identity_pubkey: 'pubkey_abc' } })),
}

describe('WebLNWallet', () => {
  let wallet: WebLNWallet

  beforeEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error jsdom doesn't have webln
    global.window = { webln: mockWebLN }
    wallet = new WebLNWallet()
  })

  it('pays an invoice and returns preimage as txid', async () => {
    const proof = await wallet.pay({
      invoice_id: 'inv_1', invoice: 'lnbc1000...',
      amount: 1000, currency: 'BTC', method: 'lightning',
      resource: '/api/data', created_at: 1000, expires_at: 2000,
    })
    expect(proof.txid).toBe('preimage123')
  })

  it('returns null from quote', async () => {
    const q = await wallet.quote({ amount: 1000, currency: 'BTC', methods: ['lightning'], description: '', expiry: 0, endpoint: '' })
    expect(q).toBeNull()
  })

  it('returns node pubkey from getAddress', async () => {
    const addr = await wallet.getAddress('BTC')
    expect(addr).toBe('pubkey_abc')
  })
})
