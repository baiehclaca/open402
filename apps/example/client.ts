import { Open402Client } from '@open402/client'
import { LNDWallet } from '@open402/lightning'
import type { PaymentOffer, PaymentInvoice, PaymentProof } from '@open402/core'

// For local testing with mock adapter, we need a mock wallet too
class MockWallet {
  async quote(_offer: PaymentOffer) { return null }
  async pay(invoice: PaymentInvoice): Promise<PaymentProof> {
    console.log(`  [wallet] Paying invoice: ${invoice.invoice_id}`)
    return { txid: `preimage_${invoice.invoice_id}` }
  }
  async getAddress(_currency: string) { return 'mock_address' }
}

const wallet = process.env['LND_REST_URL'] && process.env['LND_MACAROON']
  ? new LNDWallet({ lndRestUrl: process.env['LND_REST_URL'], macaroon: process.env['LND_MACAROON'] })
  : new MockWallet()

const client = new Open402Client({ wallet, pollIntervalMs: 500, maxPollAttempts: 20 })

const BASE = 'http://localhost:3000'

console.log('--- Fetching free endpoint ---')
const freeRes = await client.fetch(`${BASE}/api/free`)
console.log(await freeRes.json())

console.log('\n--- Fetching paywalled endpoint ---')
const paidRes = await client.fetch(`${BASE}/api/data`)
console.log(await paidRes.json())

console.log('\n--- Fetching again (should use cached receipt) ---')
const cached = await client.fetch(`${BASE}/api/data`)
console.log(await cached.json())
