export interface LNDAdapterOptions {
  lndRestUrl: string
  macaroon: string
  tlsCertPath?: string
}

export interface LNDWalletOptions {
  lndRestUrl: string
  macaroon: string
}

export interface LNDInvoiceResponse {
  payment_request: string
  r_hash: string
  add_index: string
}

export interface LNDLookupResponse {
  settled: boolean
  payment_preimage: string
  value: string
  r_hash: string
}
