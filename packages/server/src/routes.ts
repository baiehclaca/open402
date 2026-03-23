import { Router } from 'express'
import type { Request, Response } from 'express'
import { Open402Server } from './open402-server.js'

export function createWellKnownRouter(server: Open402Server): Router {
  const router = Router()

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      methods: server.getSupportedMethods(),
      currencies: server.getSupportedCurrencies(),
      receipt_ttl: server.getReceiptTtl(),
      pubkey: JSON.stringify(server.getPublicKeyJwk()),
    })
  })

  router.post('/pay', async (req: Request, res: Response) => {
    const { method, currency, resource } = req.body as {
      method?: string
      currency?: string
      resource?: string
    }

    if (!method || !currency || !resource) {
      res.status(400).json({ error: 'method, currency, and resource are required' })
      return
    }

    try {
      const result = await server.createInvoice(method, resource)
      res.json(result)
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  router.get('/pay/:invoice_id', async (req: Request, res: Response) => {
    const result = await server.pollInvoice(req.params['invoice_id'] ?? '')
    res.json(result)
  })

  return router
}
