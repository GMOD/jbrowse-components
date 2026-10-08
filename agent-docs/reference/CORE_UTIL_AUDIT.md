---
name: core-util-audit
description: What a re-audit of packages/core/src/util would otherwise re-derive — kept-on-purpose decisions and why unused-looking exports are a plugin-ABI call. Read before re-auditing core/util or deleting something there that looks unused.
audience: internal
kind: measurement
---

# packages/core/src/util audit — what a re-audit would re-derive

## Kept on purpose

- **Two `getFileName` copies stay.** `LocalFileChooser`'s shows the full local
  path and returns `undefined` for "no file"; `plugins/wiggle`'s takes a string.
  `tracks.getFileName` lives in its own dependency-free `getFileName.ts` so pure
  form helpers avoid importing MST.
- **`defaultStarts` stays `['ATG']`**, not genetic-code table 1's three starts.
  It drives sequence-track highlighting, where marking every TTG is noise.
- **`Base1DUtils.offsetBpToPx` stays.** Neighbouring comments name it as the
  exact-round-trip answer to a documented precision trap.
- **`mergeIntervals`/`gatherOverlaps` padding is per-side**, so the default
  merge window is 10kb, not 5kb. Three callers depend on that spacing.
- **`hardRowLimit` stays in the layouts.** Its throw is unreachable from the
  canvas plugin's inputs but is the only bound on `bitmap` growth for a rect of
  enormous height.
- **No branded type for the two color-channel families.** `getRed…` (0xRRGGBBAA)
  and `abgrRed…` (ABGR u32) share `(c: number) => number`, so the wrong pair
  silently swaps R and B. A brand fails because ABGR values are read from
  `Uint32Array`s, where indexing yields `number` and every read would need the
  cast that defeats the brand.
- **The five `cssColorTo*` wrappers are not duplication.** Each parses once and
  destructures differently. Collapse only if a hot path calls two on one string.
- **Cycles are real here.** `tracks.ts` re-exporting `getFileName` after its
  `../configuration` import produced `Cannot read properties of undefined`.
  Keep the re-export first; `FileHandleRestoreBanner.test.tsx` guards it. The
  codon table follows the same rule: `generateCodonTable` lives in
  `geneticCodes.ts` so `seqUtils.ts` builds `codonTable` without a module cycle.

## Unused-looking exports are an ABI call, not a reachability call

`@jbrowse/core/util` and `@jbrowse/core/util/layouts` are in `ReExports/list.ts`,
so an external runtime plugin reaches everything they export through
`jbrequire`. An in-tree grep showing no callers means dead in this repo only.
Delete knowingly; [PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md) states the
policy.
