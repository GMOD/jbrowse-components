---
status: Rejected
summary: "jbrowse.org stays non-isolated: the CloudFront header change is half an hour, but `COOP: same-origin` severs the OAuth popup handshake with no cross-browser way around it, and all isolation buys is the SharedArrayBuffer stop-token path that already benched at zero"
---

# ADR-056: jbrowse.org is not cross-origin isolated

## Status

Rejected (2026-08). Rejects deploying COOP/COEP on jbrowse.org to make
`SharedArrayBuffer` available.

## Context

`stopToken.ts` carries two mechanisms for interrupting a worker loop that never
yields: an atomic flag in a `SharedArrayBuffer`, and a revocable blob URL probed
by synchronous XHR. The SAB path is gated on `crossOriginIsolated`
(`packages/core/src/util/stopToken.ts:77`), which no deploy of ours currently
satisfies, so the blob probe is what actually runs everywhere.

The path is not speculative. `website/scripts/coi-probe.ts` serves the
jbrowse-web build with COOP/COEP and checks the observable consequences: no blob
URLs minted on the main thread, no synchronous XHR in the worker, and the
session still loads — that last one being the real question, since the token has
to survive RPC argument serialization as a `SharedArrayBuffer` rather than a
string. It passes. So the question is only whether the headers can ship.

Mechanically they can, and cheaply. The jbrowse.org origin is an S3 *website*
endpoint, which has no header control, so CloudFront is the only lever — and
distribution `E13LGELJOT4GQO` has a single default cache behavior with no
response-headers-policy and no function associations attached. Nothing to merge
with: one `create-response-headers-policy`, one attach, optionally one extra
behavior to scope it by path prefix.

## Decision

**Don't isolate.** Three findings, in increasing order of what they cost.

### 1. COEP is the cheap half, and it is not the blocker

The instinct is that `require-corp` breaks remote data loading. It does not.
CORS-mode requests are exempt from COEP outright — per MDN, requests made in
`cors` mode "won't be blocked by COEP or trigger COEP violations, but must still
be permitted by CORS." Every adapter fetch is CORS-mode, so remote
BAM/CRAM/bigWig/tabix/VCF keep working with no CORP header on the data host, and
same-origin demo data on jbrowse.org was never in scope to begin with. ESM
plugin loading is `import()`, also CORS-mode.

What breaks is the no-cors surface, and all three instances of it are ours:

- `packages/core/src/util/analytics.ts:152` injects
  `google-analytics.com/analytics.js` through a bootstrap that sets no
  `crossOrigin`.
- `packages/core/src/PluginLoader.ts:68` sets `crossOrigin = 'anonymous'` only
  when an SRI hash is present — a UMD plugin published without integrity is a
  no-cors script tag.
- `packages/core/src/PluginLoader.ts:95` loads UMD plugins in the worker via
  `importScripts`, which is no-cors by specification with no CORS opt-in
  available at all. This one cannot be fixed in our code.

`COEP: credentialless` clears all three with no code change — no-cors loads are
permitted without CORP, with credentials stripped from request and response.
Chrome 96+, Firefox 119+, **not Safari at any version**. That degrades
correctly rather than dangerously: Safari doesn't recognize the value, doesn't
isolate, `hasSharedArrayBuffer` is false, and the string token path runs. The
fallback existing is what makes the browser split tolerable.

### 2. `COOP: same-origin` breaks OAuth, with no cross-browser way around it

Isolation requires exactly `COOP: same-origin`. The value that exists for this
problem, `same-origin-allow-popups`, does not isolate — that is the entire
tradeoff it makes.

The flow it breaks: `plugins/authentication/src/OAuthModel/model.tsx:299` opens
the provider in a popup and awaits a message; the redirect lands back on our
origin and `products/jbrowse-web/src/initAuthWindow.ts:3` posts the result
through `window.opener`. Under `same-origin`, the popup is moved to a new
browsing context group the moment it navigates cross-origin, `window.opener`
becomes null, and it *stays* null when the provider redirects home — the group
switch is not undone by coming back to a same-origin document. So
`waitForOAuthMessage` never resolves: Google Drive and Dropbox sign-in hang
rather than fail, which is the worse of the two failure modes.

Chrome's `COOP: restrict-properties` was designed for exactly this case and does
grant `crossOriginIsolated` while preserving `postMessage` and `closed` on the
popup handle. It is Chrome-only — origin trial from Chrome 116, still absent
from MDN's list of COOP values. Shipping auth that works in Chrome and hangs in
Firefox and Safari is worse than not isolating.

Scoping the headers to a path prefix does not dodge this. The path that would
carry them, `/code/jb2/*`, *is* the app that performs OAuth.

### 3. The payoff is a single optimization that already benched at zero

From `stopToken.ts`'s own note: `website/scripts/cancel-bench.ts` measured 513 ms
median settle either way across a 2000× BAM cancel burst. That measurement was
sound but scoped — every loop on the alignments path is already chunked by awaits
at region granularity, so there was nothing there for an intra-loop probe to
interrupt in the first place. The workload where an in-loop probe matters is an
await-free one, `getLDMatrix.ts`'s O(n²) `Float32Array` fill being the
counter-example that comment names.

That case is real, but the blob probe already covers it. Isolation makes the
in-loop check *cheaper* (an atomic read every 10 iterations instead of a
throttled synchronous XHR), not newly possible. Nobody has measured the
difference on the workload where it would show.

And it can never be more than an optimization. An embeddable library cannot
require COOP/COEP of its host page, so the string token and its blob probe stay
compiled in and stay on the hot path for every embedded consumer regardless of
what jbrowse.org does. Isolating jbrowse.org buys a second implementation of
something that must keep working anyway.

## Consequences

- The blob-URL synchronous probe is load-bearing indefinitely. `stopToken.ts`
  already warns that it was deleted once and had to be restored; this ADR is the
  reason no deploy will ever make it dead code.
- `coi-probe.ts` is not dead code either. It is the regression check that the SAB
  path still works wherever isolation *does* exist — an embedding host page that
  isolates itself gets the fast path today with no work from us.
- **2026-08-26: the code did not implement this bullet until now.**
  `hasSharedArrayBuffer` asked whether a `SharedArrayBuffer` could be
  CONSTRUCTED, never whether the page was isolated — which agree in a browser,
  because it gates the constructor, and disagree in a V8 embedder, which both of
  ours are. Jest constructed one unconditionally, so the whole suite ran the
  fast path while every deployment ran the string path, and the two do not check
  at the same moments: that inversion hid `withProgress`'s open-phase bug
  (a9e5daba8f) for as long as it existed. Electron with `nodeIntegration: true`
  put Node's globals on the renderer, so jbrowse-desktop very likely took the
  fast path off a `file://` page as well — unverifiable from the tree, and now
  moot. The gate reads `crossOriginIsolated` directly, so this ADR's analysis
  and the code now say the same thing, and the free-rider clause above is
  unaffected: an isolated host reports isolated and gets the fast path.
- Nothing here is a code change. If someone wants the empirical blast radius
  rather than this analysis, `Cross-Origin-Embedder-Policy-Report-Only` on the
  distribution costs nothing and touches no source.
- Revisit conditions, in order: a cancel measurement on an await-free workload
  (LD or multi-sample variant, **not** a pileup — that is the bench that already
  returned zero) showing the atomic read actually beats the throttled probe; then
  a scoped second CloudFront behavior on a deploy path with no auth surface, with
  `COEP: credentialless`. The main app path stays non-isolated until
  `restrict-properties` (or an equivalent) is cross-browser.
