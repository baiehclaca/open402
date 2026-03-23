import { SignJWT, jwtVerify, generateKeyPair, exportJWK } from 'jose'
import type { PaymentConfirmation, PaymentReceipt } from './types.js'

export async function generateSigningKeyPair(): Promise<{
  privateKey: CryptoKey
  publicKey: CryptoKey
  publicKeyJwk: Record<string, unknown>
}> {
  const { privateKey, publicKey } = await generateKeyPair('ES256')
  return { privateKey, publicKey, publicKeyJwk: await exportJWK(publicKey) }
}

export async function buildReceipt(
  confirmation: PaymentConfirmation,
  resource: string,
  privateKey: CryptoKey,
  ttlSeconds = 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  // Strip query string from resource path
  const sub = resource.split('?')[0] ?? resource
  return new SignJWT({
    sub,
    amt: confirmation.amount,
    cur: confirmation.currency,
    method: confirmation.method,
    txid: confirmation.txid,
  })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(privateKey)
}

export async function verifyReceipt(
  jwt: string,
  publicKey: CryptoKey,
): Promise<PaymentReceipt | null> {
  try {
    const { payload } = await jwtVerify(jwt, publicKey)
    return payload as unknown as PaymentReceipt
  } catch {
    return null
  }
}
