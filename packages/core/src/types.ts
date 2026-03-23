export interface PaymentOffer {
  amount: number      // minor units: satoshis for BTC, cents for USD
  currency: string    // 'BTC' | 'USD' | any ticker
  methods: string[]   // ordered: ['lightning', 'usdc-base']
  description: string
  expiry: number      // unix timestamp
  endpoint: string    // /.well-known/402/pay URL
}

export interface PaymentReceipt {
  sub: string         // path only, e.g. '/api/data' (no origin, no query string)
  amt: number
  cur: string
  method: string
  txid: string
  iat: number
  exp: number
}

export interface DiscoveryDocument {
  methods: string[]
  currencies: string[]
  receipt_ttl: number   // seconds, default 3600
  pubkey: string        // JSON-serialized JWK public key
}

export interface PaymentInvoice {
  invoice_id: string
  invoice: string       // e.g. 'lnbc1000...' for Lightning
  amount: number
  currency: string
  method: string
  resource: string      // path being paid for
  created_at: number    // unix timestamp
  expires_at: number    // unix timestamp, 10 min default
}

export interface PaymentConfirmation {
  txid: string
  method: string
  amount: number
  currency: string
}

export interface PaymentQuote {
  amount: number
  currency: string
  fee?: number
}

export interface PaymentProof {
  txid: string
  preimage?: string   // Lightning payment preimage
}
