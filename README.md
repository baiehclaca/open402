# open402

> HTTP finally gets paid.

HTTP has reserved the 402 Payment Required status code since 1991. open402 makes it real — a simple, open protocol and TypeScript SDK that lets any server charge per-request and any client pay transparently, without subscriptions, API keys, or intermediaries.

## How it works

1. Client requests a resource
2. Server responds `402 Payment Required` with payment headers
3. Client creates an invoice via `POST /.well-known/402/pay`
4. Client pays via their wallet
5. Client polls until receipt is ready
6. Client retries with `Payment-Receipt: <jwt>`
7. Server responds `200 OK`

## Quick Start

### Server (Express)

```ts
import express from 'express'
import { Open402Server, createWellKnownRouter, paywall } from '@open402/server'

const app = express()
app.use(express.json())

const pay402 = new Open402Server()
await pay402.init()

// Register a payment adapter
pay402.registerAdapter(myLightningAdapter)

// Mount well-known routes
app.use('/.well-known/402', createWellKnownRouter(pay402))

// Add a paywall to any endpoint
app.get(
  '/api/data',
  paywall(pay402, { path: '/api/data', amount: 1000, currency: 'BTC' }),
  (req, res) => res.json({ secret: 'the data' }),
)
```

### Client

```ts
import { Open402Client } from '@open402/client'
import { WebLNWallet } from '@open402/lightning'

const client = new Open402Client({ wallet: new WebLNWallet() })

// Automatically handles 402, pays, and retries
const res = await client.fetch('https://api.example.com/api/data')
const data = await res.json()
```

## Packages

| Package | Description |
|---------|-------------|
| `@open402/core` | Protocol types, header parser, JWT receipts, discovery |
| `@open402/server` | Express middleware, well-known routes, `paywall()` |
| `@open402/client` | `Open402Client` with auto-pay and receipt caching |
| `@open402/lightning` | Lightning Network adapters (LND + WebLN) |

## Protocol

The open402 protocol is language-agnostic. See [spec/open402.md](spec/open402.md) for the full RFC — implementable in any language.

## Run the Example

```bash
# Terminal 1 — server
cd apps/example && pnpm server

# Terminal 2 — client
cd apps/example && pnpm client
```

## Development

```bash
pnpm install
pnpm test       # run all tests
pnpm build      # build all packages
```

## Contributing

open402 is MIT licensed. Payment adapter contributions welcome — implement the `PaymentAdapter` interface for any payment method.
