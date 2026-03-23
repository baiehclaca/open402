import { describe, it, expect, beforeEach } from 'vitest'
import { ReceiptCache } from '../receipt-cache.js'

describe('ReceiptCache', () => {
  let cache: ReceiptCache

  beforeEach(() => { cache = new ReceiptCache() })

  it('returns null when no receipt cached', () => {
    expect(cache.get('/api/data')).toBeNull()
  })

  it('returns cached receipt before expiry', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600
    cache.set('/api/data', 'jwt-token', futureExp)
    expect(cache.get('/api/data')).toBe('jwt-token')
  })

  it('returns null when receipt is expired', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 1
    cache.set('/api/data', 'jwt-token', pastExp)
    expect(cache.get('/api/data')).toBeNull()
  })

  it('clears all entries', () => {
    cache.set('/api/data', 'jwt', Math.floor(Date.now() / 1000) + 3600)
    cache.clear()
    expect(cache.get('/api/data')).toBeNull()
  })
})
