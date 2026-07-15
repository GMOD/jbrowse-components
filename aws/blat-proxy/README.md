# JBrowse BLAT proxy

A tiny AWS Lambda (SAM) that sits in front of UCSC `hgBlat`. It exists because a
browser can't call `genome.ucsc.edu` directly (CORS), and because UCSC removed
open programmatic BLAT access in 2025 — a keyless request hits a Cloudflare
Turnstile. This proxy solves both:

- **Injects a server-side `apiKey`** (UCSC account → Hub Development → API key)
  so the key never ships in the public plugin bundle. The apiKey bypasses the
  Turnstile.
- **Adds CORS headers** so `@jbrowse/plugin-blat` running in a browser can reach
  it.

It is a **transparent proxy**: the plugin already POSTs a well-formed hgBlat
body (`userSeq/type/db/output`), so the proxy just forces `apiKey` +
`output=json` onto that body and relays the response. No client request-shape
change needed — point the plugin's "BLAT server URL" field at the deployed
endpoint.

## Endpoint

`POST /blat` — body is the same `application/x-www-form-urlencoded` hgBlat body
the plugin builds. Returns hgBlat's JSON (or a JSON error on failure).
`OPTIONS /blat` — CORS preflight.

## Deploy

Requires the AWS SAM CLI and credentials. Get a UCSC apiKey first (Genome
Browser account → **My Data / Hub Development** → API key section → generate).

```bash
pnpm install
UCSC_API_KEY=your_key ./deploy.sh        # first time: sam deploy --guided
```

The `BlatProxyApiUrl` stack output is the URL to configure in the plugin (or set
as `DEFAULT_BLAT_URL` in `plugins/blat/src/blatQuery.ts` once it's stable).

## Rate limiting (follow-on, not yet implemented)

UCSC caps program-driven BLAT at **1 hit / 15 s, 5000 / day**, and this proxy
uses ONE shared key for all users. Under real load that budget will be exceeded.
Before broad rollout, add either a DynamoDB token-bucket in front of the
upstream `fetch`, a short-TTL response cache keyed by `db`+`userSeq`, or both.
The desktop "own apiKey" path (in the plugin dialog) is the pressure valve that
avoids the shared budget entirely.

## Local

```bash
pnpm test        # unit tests for the pure body-building / html-detection logic
pnpm build       # esbuild bundle to dist/index.mjs
pnpm typecheck
```
