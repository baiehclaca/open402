import type { DiscoveryDocument } from './types.js'

export async function fetchDiscovery(baseUrl: string): Promise<DiscoveryDocument> {
  const url = new URL('/.well-known/402', baseUrl).toString()
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Discovery failed: ${res.status}`)
  return res.json() as Promise<DiscoveryDocument>
}
