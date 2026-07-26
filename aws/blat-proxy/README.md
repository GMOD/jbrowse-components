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
the plugin builds. Returns hgBlat's JSON, a `429` when the shared key's budget
says wait (see below), or a JSON error on failure.

`POST /ispcr` — the same for hgPcr (In-Silico PCR): the plugin's `wp_f`/`wp_r`
body, relayed with only the apiKey overwritten. Two things differ from `/blat`,
both because hgPcr has no JSON mode: nothing forces `output=json`, and the
response comes back as `text/html`, because hgPcr's **result** is an HTML page
of FASTA amplicons. A "No matches" page is a 200, not an error — an empty
result is an answer. Only an actual Cloudflare challenge is a 502.

`OPTIONS` on either path — CORS preflight.

Both routes are one Lambda claiming one budget, deliberately. UCSC's cap is on
the key across the Genome Browser CGIs, not per CGI, so a second deployment for
hgPcr would spend twice the cap on one key.

## Deploy

Requires the AWS SAM CLI and credentials. Get a UCSC apiKey first (Genome
Browser account → **My Data / Hub Development** → API key section → generate).

```bash
pnpm install
UCSC_API_KEY=your_key ./deploy.sh        # first time: sam deploy --guided
```

The `BlatProxyApiUrl` stack output is the URL to configure in the plugin (or set
as `DEFAULT_BLAT_URL` in `plugins/blat/src/blatQuery.ts` once it's stable). To
find it for an existing deployment, without publishing it here where it would
invite traffic against the shared key's budget:

```bash
aws cloudformation describe-stacks --stack-name jbrowse-blat-proxy \
  --query "Stacks[0].Outputs[?OutputKey=='BlatProxyApiUrl'].OutputValue" --output text
```

### Bundling

`--main-fields=module,main` is load-bearing. esbuild's `--platform=node` defaults
to `main` first, which resolves the AWS SDK's CJS build; bundling that into an
ESM output produces a Lambda that dies at init with `Dynamic require of
"node:https" is not supported`. Pointing at `module` first picks the SDK's
`dist-es`, which is real ESM and also tree-shakes (1.2 MB → 821 kb). `postbuild`
imports the bundle so a repeat of that class of failure is caught by
`pnpm build` rather than by a deploy.

## Rate limiting

UCSC caps program-driven BLAT at **1 hit / 15 s, 5000 / day**, and the cap
belongs to the key — which every browser user here shares. So the budget is
enforced centrally, in DynamoDB, before the upstream call:

- **Response cache** (`cache#<sha256 of the query>`, 24h TTL by default). A
  repeat of the same assembly + sequence is served from the table and spends no
  budget. This is the biggest lever: a sequence pasted from the docs, or a user
  re-running what they just ran, costs one upstream call per day.
- **Spacing lock** (`slot`). A conditional update takes the single slot only if
  the last call is ≥15 s old, so two concurrent Lambdas can't both proceed.
- **Daily counter** (`day#<UTC date>`). Conditional increment, refused at
  `DailyMax` — **4500**, deliberately under UCSC's 5000, because their day
  boundary isn't documented and a UTC window that doesn't line up with theirs
  would otherwise overlap.

A refused request gets **429** with `Retry-After` and a message saying which
limit it hit. `X-Blat-Cache: hit|miss` says whether a 200 cost anything.

Spacing is claimed *before* the daily count on purpose: a slot spent on a call
the daily budget then refuses costs one 15 s window on a day that is already
exhausted, whereas counting first would leak a permanent unit of the day's
budget on every spacing refusal.

The budget check **fails closed** — if DynamoDB can't be reached the request is
refused rather than passed through, since an unmetered burst risks the one key
everyone depends on. A cache failure only makes things slow, so it fails open.

`ReservedConcurrentExecutions` is 5: at one upstream call per 15 s a larger
fleet has nothing to do but return 429s.

**With `BLAT_LIMIT_TABLE` unset the proxy is unmetered** (fine locally, not for
a deployment). `template.yaml` wires it, so a SAM deploy is metered by default.

The desktop "own apiKey" path (in the plugin dialog) is the pressure valve that
avoids the shared budget entirely.

### Tuning

Deploy-time parameters: `SpacingMs`, `DailyMax`, `CacheTtlSeconds`,
`MaxConcurrency`. Each maps to the `BLAT_*` env var of the same meaning.

## Local

```bash
pnpm test        # unit tests for the body-building/validation helpers + handler
pnpm build       # esbuild bundle to dist/index.mjs
pnpm typecheck
```
