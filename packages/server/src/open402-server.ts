import { generateSigningKeyPair, buildReceipt, verifyReceipt } from '@open402/core'
import type { PaymentConfirmation } from '@open402/core'
import type { PaymentAdapter, ResourcePrice } from './types.js'
import { InvoiceStore } from './invoice-store.js'

type SigningKey = Awaited<ReturnType<typeof generateSigningKeyPair>>['privateKey']

export class Open402Server {
  private readonly adapters = new Map<string, PaymentAdapter>()
  private readonly resourcePrices = new Map<string, ResourcePrice>()
  private readonly invoiceStore = new InvoiceStore()
  private privateKey!: SigningKey
  private publicKey!: SigningKey
  private publicKeyJwk!: Record<string, unknown>
  private readonly receiptTtl: number

  constructor({ receiptTtl = 3600 }: { receiptTtl?: number } = {}) {
    this.receiptTtl = receiptTtl
  }

  async init(): Promise<void> {
    const keys = await generateSigningKeyPair()
    this.privateKey = keys.privateKey
    this.publicKey = keys.publicKey
    this.publicKeyJwk = keys.publicKeyJwk
  }

  registerAdapter(adapter: PaymentAdapter): void {
    this.adapters.set(adapter.id, adapter)
  }

  registerPrice(path: string, price: ResourcePrice): void {
    this.resourcePrices.set(path, price)
  }

  getPrice(path: string): ResourcePrice | undefined {
    return this.resourcePrices.get(path)
  }

  getSupportedMethods(): string[] {
    return [...this.adapters.keys()]
  }

  getSupportedCurrencies(): string[] {
    return [...new Set([...this.adapters.values()].flatMap(a => a.currencies))]
  }

  getPublicKeyJwk(): Record<string, unknown> {
    return this.publicKeyJwk
  }

  getReceiptTtl(): number {
    return this.receiptTtl
  }

  async createInvoice(
    method: string,
    resource: string,
  ): Promise<{ invoice_id: string; invoice: string }> {
    const adapter = this.adapters.get(method)
    if (!adapter) throw new Error(`No adapter registered for method: ${method}`)

    const price = this.resourcePrices.get(resource)
    if (!price) throw new Error(`No price registered for resource: ${resource}`)

    const now = Math.floor(Date.now() / 1000)
    const offer = {
      amount: price.amount,
      currency: price.currency,
      methods: price.methods,
      description: price.description,
      expiry: now + 60,
      endpoint: '',
    }

    const paymentInvoice = await adapter.createInvoice(offer, resource)
    this.invoiceStore.set(paymentInvoice.invoice_id, {
      invoice: paymentInvoice,
      status: 'pending',
    })

    return { invoice_id: paymentInvoice.invoice_id, invoice: paymentInvoice.invoice }
  }

  async pollInvoice(invoiceId: string): Promise<{ status: string; receipt?: string }> {
    this.invoiceStore.expireOld()

    const entry = this.invoiceStore.get(invoiceId)
    if (!entry) return { status: 'not_found' }
    if (entry.status === 'paid') return { status: 'paid', receipt: entry.receipt }
    if (entry.status === 'expired') return { status: 'expired' }

    const adapter = this.adapters.get(entry.invoice.method)
    if (!adapter) return { status: 'pending' }

    const confirmation = await adapter.verifyPayment(entry.invoice)
    if (!confirmation) return { status: 'pending' }

    const receipt = await this.issueReceipt(confirmation, entry.invoice.resource)
    this.invoiceStore.update(invoiceId, { status: 'paid', receipt })
    return { status: 'paid', receipt }
  }

  async verifyReceiptJwt(jwt: string): Promise<boolean> {
    const result = await verifyReceipt(jwt, this.publicKey)
    return result !== null
  }

  async signTestReceipt(resource: string): Promise<string> {
    return buildReceipt(
      { txid: 'test', method: 'lightning', amount: 1000, currency: 'BTC' },
      resource,
      this.privateKey,
      3600,
    )
  }

  private async issueReceipt(
    confirmation: PaymentConfirmation,
    resource: string,
  ): Promise<string> {
    return buildReceipt(confirmation, resource, this.privateKey, this.receiptTtl)
  }
}
