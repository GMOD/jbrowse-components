---
name: core-util-audit
description: What a re-audit of packages/core/src/util would otherwise re-derive — kept-on-purpose decisions, why unused-looking exports are a plugin-ABI call, and what is verified clean. Read before re-auditing core/util or deleting something there that looks unused.
audience: internal
kind: measurement
---

# packages/core/src/util audit — what a re-audit would re-derive

The audit is closed; git holds the fixes. This file keeps the decisions that
look like leftovers and the checks already done.

## Kept on purpose

- **Two `getFileName` copies stay.** `LocalFileChooser`'s shows the full local
  path and returns `undefined` for "no file"; `plugins/wiggle`'s takes a string.
  `tracks.getFileName` lives in its own dependency-free `getFileName.ts` so pure
  form helpers avoid importing MST.
- **`defaultStarts` stays `['ATG']`**, not genetic-code table 1's three starts.
  It drives sequence-track highlighting, where marking every TTG is noise.
- **`Base1DUtils.offsetBpToPx` stays.** Neighbouring comments name it as the
  exact-round-trip answer to a documented precision trap.
- **`color/index.isNamedColor` stays** as the sibling of `namedColorToHex`; it
  carries the `Object.hasOwn` prototype guard's test.
- **`mergeIntervals`/`gatherOverlaps` padding is per-side**, so the default
  merge window is 10kb, not 5kb. Three callers depend on that spacing.
- **`hardRowLimit` stays in the layouts.** Its throw is unreachable from the
  canvas plugin's inputs but is the only bound on `bitmap` growth for a rect of
  enormous height.
- **No branded type for the two colour-channel families.** `getRed…` (0xRRGGBBAA)
  and `abgrRed…` (ABGR u32) share `(c: number) => number`, so the wrong pair
  silently swaps R and B. A brand fails because ABGR values are read from
  `Uint32Array`s, where indexing yields `number` and every read would need the
  cast that defeats the brand.
- **The five `cssColorTo*` wrappers are not duplication.** Each parses once and
  destructures differently. Collapse only if a hot path calls two on one string.
- **Cycles are real here.** `tracks.ts` re-exporting `getFileName` after its
  `../configuration` import produced `Cannot read properties of undefined`.
  Keep the re-export first; `FileHandleRestoreBanner.test.tsx` guards it.
- **Codon table dependency direction.** `revlist` has its own module and
  `generateCodonTable` lives in `geneticCodes.ts`, so `seqUtils.ts` can define
  `codonTable` from `getGeneticCode(1)` without a module-level cycle.

## Unused-looking exports are an ABI call, not a reachability call

`@jbrowse/core/util` and `@jbrowse/core/util/layouts` are in `ReExports/list.ts`,
so an external runtime plugin reaches everything they export through
`jbrequire`. An in-tree grep showing no callers means dead in this repo only.
Delete knowingly; [PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md) states the
policy. The block-renderer layout members went because the API they served
(`BoxRendererType`) is already gone in v5.

`index.ts` exports the unused `bpUtils.bpToPx` under the same name as the live
`Base1DUtils.bpToPx`, a public-surface collision.

## Verified clean

- `crypto.ts` pure-JS fallback matches Node byte-for-byte (MD5, SHA-256 padding
  boundaries, AES-256-CBC, OpenSSL `Salted__`). `getRandomBytes` silently
  degrades to `Math.random()`.
- `linkify.ts` is not an XSS hole: the URL class excludes `'`, the scheme is
  restricted, and `SanitizedHTML.tsx` runs it before DOMPurify.
- `color/cssColorsLevel4.ts` matches the CSS Color 4 name list exactly.
- MST swallows exceptions thrown from `beforeDestroy`, so an undefined disposer
  in `TimeTraveller.beforeDestroy` is a swallowed `TypeError`, not an aborted
  destroy chain.
- The three former `shorten()`s were a name collision, now `truncateLabel` and
  `snippetAround`.
