import express from 'express'
import { Open402Server } from '@open402/server'
import { createWellKnownRouter, paywall } from '@open402/server'
import { LightningAdapter } from '@open402/lightning'

const app = express()
app.use(express.json())

const pay402 = new Open402Server({ receiptTtl: 3600 })
await pay402.init()

// Register Lightning adapter if LND is available
if (process.env['LND_REST_URL'] && process.env['LND_MACAROON']) {
  pay402.registerAdapter(new LightningAdapter({
    lndRestUrl: process.env['LND_REST_URL'],
    macaroon: process.env['LND_MACAROON'],
  }))
  console.log('Lightning adapter registered')
} else {
  // Mock adapter for local testing (auto-settles invoices)
  pay402.registerAdapter({
    id: 'lightning',
    currencies: ['BTC'],
    async createInvoice(offer, resource) {
      const now = Math.floor(Date.now() / 1000)
      return {
        invoice_id: `mock_${Math.random().toString(36).slice(2)}`,
        invoice: 'lnbc1mock...',
        amount: offer.amount,
        currency: offer.currency,
        method: 'lightning',
        resource,
        created_at: now,
        expires_at: now + 600,
      }
    },
    async verifyPayment(invoice) {
      return {
        txid: `preimage_${invoice.invoice_id}`,
        method: 'lightning',
        amount: invoice.amount,
        currency: invoice.currency,
      }
    },
  })
  console.log('Mock Lightning adapter registered (no LND_REST_URL set)')
}

// Mount well-known routes
app.use('/.well-known/402', createWellKnownRouter(pay402))

// Free endpoint
app.get('/api/free', (_req, res) => {
  res.json({ message: 'This data is free!' })
})

// Paywalled endpoint — 1000 satoshis
app.get(
  '/api/data',
  paywall(pay402, { path: '/api/data', amount: 1000, currency: 'BTC', description: 'Premium market data' }),
  (_req, res) => {
    res.json({ message: 'You paid for this. Here is your premium data.', timestamp: Date.now() })
  },
)

app.listen(3000, () => {
  console.log('open402 example server running on http://localhost:3000')
  console.log('  GET /api/free  — free endpoint')
  console.log('  GET /api/data  — paywalled (1000 sats)')
})
