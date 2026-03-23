import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InvoiceStore } from '../invoice-store.js'
import type { PaymentInvoice } from '@open402/core'

const makeInvoice = (overrides: Partial<PaymentInvoice> = {}): PaymentInvoice => ({
  invoice_id: 'inv_1',
  invoice: 'lnbc1000...',
  amount: 1000,
  currency: 'BTC',
  method: 'lightning',
  resource: '/api/data',
  created_at: 1000000,
  expires_at: 1000600,
  ...overrides,
})

describe('InvoiceStore', () => {
  let store: InvoiceStore

  beforeEach(() => { store = new InvoiceStore() })

  it('stores and retrieves a pending invoice', () => {
    const inv = makeInvoice()
    store.set(inv.invoice_id, { invoice: inv, status: 'pending' })
    expect(store.get('inv_1')?.status).toBe('pending')
  })

  it('returns undefined for unknown invoice', () => {
    expect(store.get('nope')).toBeUndefined()
  })

  it('updates status to paid with receipt', () => {
    const inv = makeInvoice()
    store.set(inv.invoice_id, { invoice: inv, status: 'pending' })
    store.update('inv_1', { status: 'paid', receipt: 'jwt-token' })
    expect(store.get('inv_1')?.status).toBe('paid')
    expect(store.get('inv_1')?.receipt).toBe('jwt-token')
  })

  it('marks expired invoices as expired', () => {
    const inv = makeInvoice({ expires_at: 1 }) // already expired
    store.set(inv.invoice_id, { invoice: inv, status: 'pending' })
    store.expireOld()
    expect(store.get('inv_1')?.status).toBe('expired')
  })
})
