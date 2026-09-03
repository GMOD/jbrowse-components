---
name: config-and-sessions
description: Relative-URI resolution, and why a single ambient base is the wrong answer to it.
---

# Config & sessions

**Global config overrides.** Admin-level defaults (e.g. show paired arcs by default)
across all tracks.

**Hash password in share links.** Password only needed at startup (read then deleted) —
store in URL hash, clear on first navigation.

**LGVSyntenyDisplay "Query name" coloring.** Re-implement the removed color-by-query-name
(hash to color).

**Breakpoint connectors.** Smooth out the awkward blue/green curves (currently arbitrary
Y increase/loop).

**Relative-URI resolution: `bigWigs` shorthand can't be relative (issue #3562), and
`addRelativeUris` is shape-heuristic.** Today relative URLs resolve via a three-stage
pipeline: `addRelativeUris` (`packages/product-core/src/sessionUtils.ts:333`) walks raw
config JSON and stamps a synthetic `baseUri` next to every object with a `uri` key;
`UriLocation` (`packages/core/src/util/types/mst.ts:49`) carries `baseUri` inline; and
`resolveUriLocation` (`packages/core/src/util/io/index.ts:40`) does `new URL(uri, baseUri)`
at fetch time. Coupled boilerplate hangs off it: each adapter's `preProcessSnapshot` threads
`baseUri: snap.baseUri` into its real fileLocation slot + every sidecar (Gff3Tabix, Bam,
Cram, TwoBit, Hic, Maf, Trix, Cytoband, the shared `normalizeUriSnapshot`); export strips the
synthetic keys (`jbrowseModel.ts:35` `removeAttr(…, 'baseUri')`, `HeaderButtons.tsx:36`); and
`addRelativeUris` must be re-invoked at every ingest site (jbrowse-web loader, desktop hubs,
jbrowse-img `resolveHub`, connection `doConnect`, plus 3 hand-rolled copies in
react-app examples-site).

**Root cause of #3562:** the walk's detection rule is a heuristic on JSON *shape* — "an
object with a `uri` key is a location." A MultiWiggle `bigWigs: ['a.bw', 'b.bw']` is an array
of **bare strings** with no `uri` key, so nothing gets a base; `MultiWiggleAdapter.ts:99`
then builds `{ uri: 'a.bw' }` with no base → 404. `subadapters` with `{ bigWigLocation:
{ uri } }` works only because it happens to expose a literal `uri` key. Same blind spot exists
for any `frozen` slot whose interior neither the walker nor the config schema can introspect.

**A single ambient root base (tempting but wrong).** Investigated and rejected — the inline
per-location `baseUri` is load-bearing exactly where a single root can't reach: (1) RPC
workers build adapters from just a config snapshot + a bare `sessionId` routing string
(`dataAdapterCache.ts:82`), no session/root context — the base reaches the worker *only*
because it's embedded per-location (same reason `internetAccountPreAuthorization` is inline);
(2) connections **nest** bases — `JB2TrackHubConnection/doConnect.ts:26` and UCSC hubs stamp
*their own* config URL as the base for their tracks, so a live session holds N different bases
on different hosts, and the `?? base.href` non-overwrite in `addRelativeUris:342` is what lets
an inner connection base win; (3) shared sessions are origin-portable precisely because
resolution is inline/self-contained (`sessionSharing.ts` reads no ambient state); (4) desktop
has no single base (local paths use none, remote hubs use per-hub). Collapsing to one base
loses the per-location→origin mapping irreversibly.

**Proposed fixes (two independent decisions — don't conflate):**

- *Fix #3562 pointwise (safe, ship it):* teach the walker the one URI-shorthand key it can't
  see — a small explicit allowlist (`uri`, `bigWigs`) rather than adapter-name knowledge. This
  is the same pointwise patch under any base model; it does *not* make the mechanism more
  "systematic" (frozen slots stay opaque). Forces a matching `MultiWiggleAdapter.getAdaptersImpl`
  tweak since it currently assumes `bigWigs` entries are strings.

- *Migrate `addRelativeUris` to resolve-to-absolute at ingest (NOT unambiguously better —
  reconsider carefully):* rewriting `uri = new URL(uri, base).href` instead of stamping a
  sidecar would delete the strip logic and per-adapter `baseUri` threading and needs zero
  worker plumbing (URIs arrive absolute). **But it regresses a real feature:** the current lazy
  model never mutates `uri`, so the admin "Save config" flow round-trips relative-in →
  relative-out (`jbrowseModel.ts:33` strips `baseUri` deliberately), making a saved config
  **origin-relocatable** — move config+data dir to a new host and it re-resolves against the
  new `window.location`. Resolve-at-ingest pins saved configs to one origin. So the "strip
  boilerplate" isn't debt — it implements relocatability. Also, the per-adapter threading is
  defensive (any path passing `{uri:'rel', baseUri}` straight to an adapter still needs it), so
  it can't be fully removed anyway.

**Recommendation:** ship the `bigWigs` allowlist fix (with the `getAdaptersImpl` change) to
close #3562, keep the lazy per-location `baseUri` model, and treat relocatable configs as an
intended property rather than debt. The resolve-to-absolute migration, if ever pursued, is a
separate proposal that must first answer whether saved configs should be pinned to an origin
(for most deployments: no).
