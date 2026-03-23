import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Open402Server } from '../open402-server.js'
import { createWellKnownRouter } from '../routes.js'
import type { PaymentAdapter } from '../types.js'

const mockAdapter: PaymentAdapter = {
  id: 'lightning',
  currencies: ['BTC'],
  createInvoice: vi.fn(async () => ({
    invoice_id: 'inv_001',
    invoice: 'lnbc1000...',
    amount: 1000,
    currency: 'BTC',
    method: 'lightning',
    resource: '/api/data',
    created_at: 1000,
    expires_at: 2000,
  })),
  verifyPayment: vi.fn(async () => null),
}

describe('well-known routes', () => {
  let app: express.Application
  let server: Open402Server

  beforeEach(async () => {
    server = new Open402Server()
    await server.init()
    server.registerAdapter(mockAdapter)
    server.registerPrice('/api/data', { amount: 1000, currency: 'BTC', methods: ['lightning'], description: 'test' })

    app = express()
    app.use(express.json())
    app.use('/.well-known/402', createWellKnownRouter(server))
  })

  it('GET /.well-known/402 returns discovery document', async () => {
    const res = await request(app).get('/.well-known/402')
    expect(res.status).toBe(200)
    expect(res.body.methods).toContain('lightning')
    expect(res.body.currencies).toContain('BTC')
    expect(typeof res.body.receipt_ttl).toBe('number')
    expect(typeof res.body.pubkey).toBe('string')
  })

  it('POST /.well-known/402/pay creates an invoice', async () => {
    const res = await request(app)
      .post('/.well-known/402/pay')
      .send({ method: 'lightning', currency: 'BTC', resource: '/api/data' })
    expect(res.status).toBe(200)
    expect(res.body.invoice_id).toBe('inv_001')
    expect(res.body.invoice).toBe('lnbc1000...')
  })

  it('POST /.well-known/402/pay returns 400 for missing fields', async () => {
    const res = await request(app).post('/.well-known/402/pay').send({ method: 'lightning' })
    expect(res.status).toBe(400)
  })

  it('GET /.well-known/402/pay/:id returns pending for new invoice', async () => {
    const res = await request(app).get('/.well-known/402/pay/inv_001')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('not_found')
  })
})
