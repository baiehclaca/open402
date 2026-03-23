// packages/core/src/__tests__/receipt.test.ts
import { describe, it, expect } from 'vitest'
import { generateSigningKeyPair, buildReceipt, verifyReceipt } from '../receipt.js'
import type { PaymentConfirmation } from '../types.js'

describe('receipt', () => {
  it('builds a verifiable receipt JWT', async () => {
    const { privateKey, publicKey } = await generateSigningKeyPair()
    const confirmation: PaymentConfirmation = {
      txid: 'abc123',
      method: 'lightning',
      amount: 1000,
      currency: 'BTC',
    }
    const jwt = await buildReceipt(confirmation, '/api/data', privateKey, 3600)
    expect(typeof jwt).toBe('string')
    expect(jwt.split('.').length).toBe(3)  // valid JWT format

    const receipt = await verifyReceipt(jwt, publicKey)
    expect(receipt).not.toBeNull()
    expect(receipt!.sub).toBe('/api/data')
    expect(receipt!.amt).toBe(1000)
    expect(receipt!.cur).toBe('BTC')
    expect(receipt!.txid).toBe('abc123')
  })

  it('returns null for an invalid JWT', async () => {
    const { publicKey } = await generateSigningKeyPair()
    const result = await verifyReceipt('not.a.jwt', publicKey)
    expect(result).toBeNull()
  })

  it('returns null for a JWT signed with a different key', async () => {
    const { privateKey } = await generateSigningKeyPair()
    const { publicKey: wrongPublicKey } = await generateSigningKeyPair()
    const confirmation: PaymentConfirmation = { txid: 'x', method: 'lightning', amount: 1, currency: 'BTC' }
    const jwt = await buildReceipt(confirmation, '/api/data', privateKey, 3600)
    const result = await verifyReceipt(jwt, wrongPublicKey)
    expect(result).toBeNull()
  })
})
