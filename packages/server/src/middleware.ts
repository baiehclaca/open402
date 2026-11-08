import type { Request, Response, NextFunction } from 'express'
import { serializePaymentHeaders } from '@open402/core'
import { Open402Server } from './open402-server.js'
import type { PaywallOptions } from './types.js'

export function paywall(server: Open402Server, options: PaywallOptions & { path: string }) {
  const {
    path,
    amount,
    currency,
    description = 'Paid access',
  } = options

  server.registerPrice(path, {
    amount,
    currency,
    methods: server.getSupportedMethods(),
    description,
  })

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const receiptHeader = req.headers['payment-receipt']

    if (typeof receiptHeader === 'string' && receiptHeader.length > 0) {
      const valid = await server.verifyReceiptFor(receiptHeader, path, { amount, currency })
      if (valid) {
        next()
        return
      }
      res.status(401).json({ error: 'Invalid or expired payment receipt' })
      return
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`
    const expiryTs = Math.floor(Date.now() / 1000) + 60

    const headers = serializePaymentHeaders({
      amount,
      currency,
      methods: server.getSupportedMethods(),
      description,
      expiry: expiryTs,
      endpoint: `${baseUrl}/.well-known/402/pay`,
    })

    res.status(402).set(headers).json({
      error: 'Payment Required',
      amount,
      currency,
      methods: server.getSupportedMethods(),
    })
  }
}
