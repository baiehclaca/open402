import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { Open402Server } from '../open402-server.js'
import { paywall } from '../middleware.js'
import { createWellKnownRouter } from '../routes.js'

describe('paywall middleware', () => {
  let app: express.Application
  let server: Open402Server

  beforeEach(async () => {
    server = new Open402Server()
    await server.init()

    app = express()
    app.use(express.json())
    app.use('/.well-known/402', createWellKnownRouter(server))

    app.get(
      '/api/data',
      paywall(server, { path: '/api/data', amount: 1000, currency: 'BTC' }),
      (_req, res) => { res.json({ secret: 'the data' }) },
    )
    app.get(
      '/api/premium',
      paywall(server, { path: '/api/premium', amount: 50000, currency: 'BTC' }),
      (_req, res) => { res.json({ secret: 'premium' }) },
    )
  })

  it('rejects a receipt bought for a different (cheaper) resource', async () => {
    const jwt = await server.signTestReceipt('/api/data')
    const res = await request(app).get('/api/premium').set('Payment-Receipt', jwt)
    expect(res.status).toBe(401)
  })

  it('rejects a receipt whose amount is below the price', async () => {
    const jwt = await server.signTestReceipt('/api/premium')
    const res = await request(app).get('/api/premium').set('Payment-Receipt', jwt)
    expect(res.status).toBe(401)
  })

  it('returns 402 with payment headers when no receipt provided', async () => {
    const res = await request(app).get('/api/data')
    expect(res.status).toBe(402)
    expect(res.headers['payment-amount']).toBe('1000')
    expect(res.headers['payment-currency']).toBe('BTC')
    expect(res.headers['payment-methods']).toBeDefined()
    expect(res.headers['payment-endpoint']).toContain('/.well-known/402/pay')
  })

  it('returns 200 when valid receipt is provided', async () => {
    const jwt = await server.signTestReceipt('/api/data')
    const res = await request(app)
      .get('/api/data')
      .set('Payment-Receipt', jwt)
    expect(res.status).toBe(200)
    expect(res.body.secret).toBe('the data')
  })

  it('returns 401 when an invalid receipt is provided', async () => {
    const res = await request(app)
      .get('/api/data')
      .set('Payment-Receipt', 'bad.jwt.token')
    expect(res.status).toBe(401)
  })
})
