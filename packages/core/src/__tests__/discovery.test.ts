// packages/core/src/__tests__/discovery.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchDiscovery } from '../discovery.js'

describe('fetchDiscovery', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('fetches and returns discovery document', async () => {
    const doc = {
      methods: ['lightning'],
      currencies: ['BTC'],
      receipt_ttl: 3600,
      pubkey: '{"kty":"EC"}',
    }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => doc,
    } as Response)

    const result = await fetchDiscovery('https://api.example.com')
    expect(result.methods).toEqual(['lightning'])
    expect(result.receipt_ttl).toBe(3600)
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/.well-known/402')
  })

  it('throws when discovery endpoint fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response)
    await expect(fetchDiscovery('https://api.example.com')).rejects.toThrow('Discovery failed: 404')
  })
})
