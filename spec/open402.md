# open402 Protocol Specification

**Version**: 1.0
**Status**: Draft RFC

---

## 1. Overview and Motivation

HTTP 402 Payment Required has been reserved since 1991. For over three decades it sat unused — a placeholder for a future internet where machines could pay each other directly. open402 makes that future real.

open402 is a lightweight, currency-agnostic protocol layered on top of standard HTTP. It gives servers a way to charge per-request and gives clients a way to pay transparently, without subscriptions, API keys, or centralized payment intermediaries.

### Design Goals

- **Open**: Any server, any client, any payment method. The protocol is an interface, not a product.
- **Currency-agnostic**: Works with Bitcoin (Lightning Network), stablecoins (USDC), and fiat (USD, EUR). New payment methods can be added without changing the protocol.
- **Self-verifying**: Receipts are JWTs signed by the server's key. No central authority or shared database is required to validate payment.
- **Minimal**: Seven HTTP headers and three well-known endpoints. No new content types. No special clients required beyond protocol support.
- **Composable**: Slots into any existing HTTP stack. A server adds a middleware; a client wraps `fetch`.

---

## 2. HTTP Headers

All payment negotiation happens through standard HTTP headers. Headers travel in both directions: server-to-client (in the 402 response) and client-to-server (in the retry request).

### 2.1 Server-to-Client Headers

These headers appear in a `402 Payment Required` response.

| Header | Direction | Description |
|--------|-----------|-------------|
| `Payment-Amount` | server → client | Payment amount in the smallest unit of the currency (satoshis for BTC, cents for USD/EUR). Must be an unsigned integer. |
| `Payment-Currency` | server → client | ISO 4217 currency code (`USD`, `EUR`) or the string `BTC` for Bitcoin. |
| `Payment-Methods` | server → client | Comma-separated list of accepted payment method identifiers (e.g. `lightning, usdc-base`). |
| `Payment-Description` | server → client | Human-readable description of what is being purchased. Intended for display to the end user. |
| `Payment-Expiry` | server → client | Unix timestamp (seconds since epoch) after which this payment offer expires and must be re-requested. |
| `Payment-Endpoint` | server → client | Full URL of the payment endpoint to POST to. Typically `https://host/.well-known/402/pay`. |

### 2.2 Client-to-Server Headers

This header appears in the retry request after a successful payment.

| Header | Direction | Description |
|--------|-----------|-------------|
| `Payment-Receipt` | client → server | A JWT issued by the server after payment confirmation. Proves payment for the specific resource. |

---

## 3. Currency Unit Assumptions

All amounts in open402 are unsigned integers in the smallest unit of the given currency. Fractional amounts are not permitted.

| Currency | Amount Unit | Conversion |
|----------|-------------|------------|
| `BTC` | Satoshi | 1 BTC = 100,000,000 satoshis |
| `USD` | Cent | 1 USD = 100 cents |
| `EUR` | Euro cent | 1 EUR = 100 cents |

**Rule**: If `Payment-Currency` is `USD` and `Payment-Amount` is `500`, the charge is $5.00. If `Payment-Currency` is `BTC` and `Payment-Amount` is `1000`, the charge is 1000 satoshis (0.00001 BTC).

Implementors adding new currencies MUST document the smallest unit used.

---

## 4. Well-Known Endpoints

Servers implementing open402 MUST expose three endpoints under the `/.well-known/402/` path. These endpoints handle discovery, invoice creation, and payment polling.

### 4.1 `GET /.well-known/402` — Discovery

Allows clients (and implementors) to discover what payment methods and currencies a server supports.

**Request**: No body or query parameters required.

**Response 200**:

```json
{
  "methods": ["lightning", "usdc-base"],
  "currencies": ["BTC"],
  "receipt_ttl": 3600,
  "pubkey": "{\"kty\":\"EC\",\"crv\":\"P-256\",...}"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `methods` | string[] | List of supported payment method identifiers |
| `currencies` | string[] | List of supported currency codes |
| `receipt_ttl` | integer | Receipt validity in seconds after issuance |
| `pubkey` | string | JSON-serialized JWK (JSON Web Key) of the server's public key, used by clients to verify receipt JWTs |

The `pubkey` field is a JSON-serialized JWK object. Clients MUST parse it as JSON before using it for JWT verification.

---

### 4.2 `POST /.well-known/402/pay` — Create Invoice

Creates a payment invoice for a specific resource.

**Request body** (`application/json`):

```json
{
  "method": "lightning",
  "currency": "BTC",
  "resource": "/api/data"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `method` | string | yes | Payment method identifier, must be in the server's supported `methods` list |
| `currency` | string | yes | Currency code, must be in the server's supported `currencies` list |
| `resource` | string | yes | The path of the resource being purchased (normalized, path only — see Section 7) |

**Response 200** (invoice created):

```json
{
  "invoice_id": "abc123",
  "invoice": "lnbc1000..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `invoice_id` | string | Opaque identifier used to poll for payment status |
| `invoice` | string | Payment-method-specific invoice string. For Lightning: a BOLT-11 invoice. For USDC: a payment address or URI. |

**Response 400** (bad request):

```json
{ "error": "Unknown payment method: stripe" }
```

Servers MUST return 400 if any required field is missing, if `method` is not in the supported list, or if `currency` is not supported.

---

### 4.3 `GET /.well-known/402/pay/:invoice_id` — Poll for Receipt

Clients poll this endpoint after paying the invoice to retrieve their receipt JWT.

**Path parameter**: `invoice_id` — the value returned by `POST /.well-known/402/pay`.

**Response 200 — Pending** (payment not yet confirmed):

```json
{ "status": "pending" }
```

**Response 200 — Paid** (payment confirmed, receipt ready):

```json
{
  "status": "paid",
  "receipt": "<jwt>"
}
```

**Response 200 — Expired** (invoice TTL has elapsed without payment):

```json
{ "status": "expired" }
```

**Response 200 — Not Found** (invoice ID is unknown):

```json
{ "status": "not_found" }
```

All four states are returned as HTTP 200. Clients distinguish them by reading the `status` field. The `expired` and `not_found` states are terminal — the client MUST NOT continue polling.

---

## 5. The Handshake: Complete 5-Step Flow

The following describes the complete end-to-end flow for a successful paid request.

```
Client                                      Server
  |                                            |
  |  GET /api/data                             |
  |  ---------------------------------------->|
  |                                            |
  |  402 Payment Required                      |
  |  Payment-Amount: 1000                      |
  |  Payment-Currency: BTC                     |
  |  Payment-Methods: lightning                |
  |  Payment-Description: Access /api/data     |
  |  Payment-Expiry: 1742003600               |
  |  Payment-Endpoint: https://host/...        |
  |<------------------------------------------|
  |                                            |
  |  POST /.well-known/402/pay                 |
  |  { method, currency, resource }            |
  |  ---------------------------------------->|
  |                                            |
  |  200 OK                                    |
  |  { invoice_id, invoice }                   |
  |<------------------------------------------|
  |                                            |
  |  [Client pays invoice via wallet]          |
  |                                            |
  |  GET /.well-known/402/pay/:invoice_id      |
  |  ---------------------------------------->|
  |  200 { status: "paid", receipt: "<jwt>" }  |
  |<------------------------------------------|
  |                                            |
  |  GET /api/data                             |
  |  Payment-Receipt: <jwt>                    |
  |  ---------------------------------------->|
  |                                            |
  |  200 OK                                    |
  |  { ... resource data ... }                 |
  |<------------------------------------------|
```

### Steps

1. **Client requests a paywalled resource.** The client makes a standard HTTP request with no payment headers.

2. **Server responds 402 with payment headers.** The server returns `402 Payment Required` and includes all `Payment-*` headers describing the price, currency, accepted methods, and where to pay.

3. **Client POSTs to the Payment-Endpoint to create an invoice.** The client sends a JSON body specifying the chosen `method`, `currency`, and the `resource` path (normalized per Section 7). The server responds with an `invoice_id` and an `invoice` string.

4. **Client pays the invoice via their wallet.** This step is payment-method specific and happens outside the HTTP protocol (e.g. the user approves a Lightning payment in their wallet app).

5. **Client polls `GET /.well-known/402/pay/:id` until `status: paid`.** The client polls at the interval defined in Section 9 until the server confirms payment and returns a receipt JWT.

6. **Client retries the original request with `Payment-Receipt: <jwt>`.** The client adds the JWT to the `Payment-Receipt` header and re-sends the original request.

7. **Server verifies the receipt and returns 200 OK.** The server validates the JWT signature, checks `sub` matches the requested path, and checks `exp` is in the future. On success it returns the resource.

---

## 6. Receipt JWT Payload Schema

After payment is confirmed, the server issues a receipt as a signed JWT. This receipt is self-verifying — any server holding the corresponding private key can validate it without a database lookup.

### Algorithm

- **Signing algorithm**: ES256 (ECDSA with P-256 curve and SHA-256)
- **Key source**: The server's private key (corresponding to the `pubkey` advertised in `GET /.well-known/402`)

### Payload

```json
{
  "sub": "/api/data",
  "amt": 1000,
  "cur": "BTC",
  "method": "lightning",
  "txid": "abc123",
  "iat": 1742000000,
  "exp": 1742003600
}
```

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | The normalized resource path this receipt is valid for (path only — see Section 7) |
| `amt` | integer | Amount paid, in smallest currency unit |
| `cur` | string | Currency code |
| `method` | string | Payment method used |
| `txid` | string | Payment provider transaction ID or invoice ID |
| `iat` | integer | Unix timestamp when the receipt was issued |
| `exp` | integer | Unix timestamp when the receipt expires |

### Validation Requirements

Servers MUST reject receipts that fail any of the following checks:

1. Signature verification fails against the server's public key
2. `exp` is in the past (receipt has expired)
3. `sub` does not match the normalized path of the requested resource
4. `cur` does not match an accepted currency
5. `amt` is less than the current price for the resource

---

## 7. `sub` Normalization Rules

The `sub` claim in the receipt JWT, and the `resource` field in the invoice creation request, MUST be normalized to a bare path. This ensures consistent matching across clients that may pass full URLs.

### Rules

1. **Strip the origin**: Remove the scheme (`https://`), host, and port.
2. **Strip the query string**: Remove everything after and including `?`.
3. **Strip the fragment**: Remove everything after and including `#`.
4. **Use the path only**: The result must start with `/`.

### Examples

| Input | Normalized |
|-------|------------|
| `https://example.com/api/data?q=1` | `/api/data` |
| `https://example.com:8080/api/data#section` | `/api/data` |
| `/api/data?token=abc` | `/api/data` |
| `/api/data` | `/api/data` |

Clients MUST normalize before sending `resource` in the invoice creation request. Servers MUST normalize before embedding `sub` in the receipt and before comparing `sub` against the requested path.

---

## 8. Error Responses

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad request — missing required fields, unknown payment method, or unsupported currency |
| 401 | Invalid or expired receipt — the `Payment-Receipt` header failed validation |
| 402 | Payment required — no receipt was provided or the receipt does not match this resource |
| 504 | Payment provider timeout — the upstream payment network did not respond in time |

Error response bodies SHOULD follow this format:

```json
{ "error": "Human-readable description of the problem" }
```

---

## 9. Polling Behavior

When a client is waiting for payment confirmation after paying an invoice, it MUST poll `GET /.well-known/402/pay/:invoice_id` with the following behavior:

- **Interval**: 2 seconds between each poll attempt
- **Maximum attempts**: 30 (total polling window of 60 seconds)
- **Terminal states**: `expired` and `not_found` — the client MUST stop polling immediately and treat the payment flow as failed
- **Timeout**: If 30 attempts are exhausted without a `paid` status, the client SHOULD surface an error to the caller

Clients MUST NOT poll more frequently than once per second. Servers MAY rate-limit clients that exceed this.

---

## 10. Security Considerations

### Self-Verifying Receipts

Receipts are ES256-signed JWTs. Any server holding the private key can issue them; any holder of the corresponding public key (published at `GET /.well-known/402`) can verify them. No central authority, shared database, or callback is required for receipt validation.

### Path Binding

Servers MUST verify that the `sub` claim in the receipt exactly matches the normalized path of the resource being requested. A receipt for `/api/photos` MUST NOT grant access to `/api/videos`. Normalization rules in Section 7 must be applied consistently on both sides.

### Expiry Enforcement

Servers MUST verify that `exp` is strictly in the future at the time of the request. Expired receipts MUST be rejected with `401 Unauthorized`. The `receipt_ttl` value advertised in discovery (typically 3600 seconds) limits the replay window — a receipt cannot be reused indefinitely.

### Short-Lived Receipts

Implementors SHOULD keep `receipt_ttl` short (3600 seconds recommended). Shorter TTLs reduce the window during which a stolen receipt can be replayed. For high-value resources, lower TTLs (60–300 seconds) are appropriate.

### Key Management

Servers MUST protect their private key. The public key is published openly at `GET /.well-known/402`. If the private key is compromised, all previously issued receipts become forgeable. Key rotation requires re-publishing the `pubkey` in discovery and invalidates all outstanding receipts.

### Transport Security

All open402 communication MUST occur over HTTPS. Plain HTTP MUST NOT be used. Receipts transmitted over plaintext HTTP are trivially stolen and replayed.
