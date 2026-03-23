import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Open402Client } from '../open402-client.js'
import type { WalletAdapter } from '../types.js'
import type { PaymentInvoice, PaymentOffer } from '@open402/core'

const mockWallet: WalletAdapter = {
  quote: vi.fn(async () => null),
  pay: vi.fn(async () => ({ txid: 'abc', preimage: 'pre123' })),
  getAddress: vi.fn(async () => 'addr'),
}

describe('Open402Client', () => {
  let client: Open402Client

  beforeEach(() => {
    vi.restoreAllMocks()
    client = new Open402Client({ wallet: mockWallet, pollIntervalMs: 0, maxPollAttempts: 3 })
  })

  it('returns response directly when no 402', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    )
    const res = await client.fetch('https://api.example.com/api/free')
    expect(res.status).toBe(200)
  })

  it('auto-pays on 402 and retries with receipt', async () => {
    const payHeaders = new Headers({
      'payment-amount': '1000',
      'payment-currency': 'BTC',
      'payment-methods': 'lightning',
      'payment-description': 'test',
      'payment-expiry': String(Math.floor(Date.now() / 1000) + 60),
      'payment-endpoint': 'https://api.example.com/.well-known/402/pay',
    })

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 402, headers: payHeaders }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ invoice_id: 'inv_1', invoice: 'lnbc...' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'paid', receipt: 'receipt-jwt' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ secret: 'data' }), { status: 200 }))

    global.fetch = fetchMock

    const res = await client.fetch('https://api.example.com/api/data')
    expect(res.status).toBe(200)
    const retryCall = fetchMock.mock.calls[3] as [string, RequestInit]
    expect((retryCall[1]?.headers as Record<string, string>)?.['Payment-Receipt']).toBe('receipt-jwt')
  })

  it('uses cached receipt on second request without re-paying', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ secret: 'data' }), { status: 200 }))

    global.fetch = fetchMock

    client['receiptCache'].set('/api/data', 'cached-jwt', Math.floor(Date.now() / 1000) + 3600)
    const res = await client.fetch('https://api.example.com/api/data')
    expect(res.status).toBe(200)
    const call = fetchMock.mock.calls[0] as [string, RequestInit]
    expect((call[1]?.headers as Record<string, string>)?.['Payment-Receipt']).toBe('cached-jwt')
  })
})
