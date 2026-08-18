---
name: core-util-audit
description: What is left from the 2026-07-31 audit of packages/core/src/util — the latent typing/contract items still open, the dead code that is a plugin-ABI decision rather than a reachability question, the two structural nits, and the list verified clean. Read before re-auditing core/util or deleting something there that looks unused.
audience: internal
---

# packages/core/src/util audit — what is left

Audit of `packages/core/src/util/` (2026-07-31), six parallel read-only passes
over disjoint subsets, everything verified by reading the code and grepping call
sites.

**The audit is closed.** No reachable bugs are left open; the latent/typing
list, the unambiguous dead code and the structural split all landed. Git holds
the fixes — `git log --oneline -- packages/core/src/util` around 2026-07-31 is
the list, and each one carries its own reasoning. What is below is only what a
re-audit would otherwise re-derive: the items still open, the deletions that are
a decision rather than a mechanical call, and the things already checked so
nobody checks them twice.

## Decisions taken during the fixes, so they are not undone

These look like leftovers and are not:

- **Three `getFileName` copies are down to two, and both stay.**
  `LocalFileChooser`'s shows the *full* local path and returns `undefined` for
  "no file"; `plugins/wiggle`'s takes a string. Not duplicates of
  `tracks.getFileName`, which now lives in its own dependency-free
  `getFileName.ts` so the pure form helpers can use it without dragging in MST.
- **`defaultStarts` stays `['ATG']`**, not genetic-code table 1's
  `['TTG','CTG','ATG']`. It drives sequence-track highlighting, where marking
  every TTG would be noise.
- **`Base1DUtils.offsetBpToPx` was kept against the dead-code list.** Three
  neighbouring comments name it as the exact-round-trip answer to a documented
  precision trap; deleting it makes that documentation dangle.
- **`color/index.isNamedColor` was kept** as the one-line sibling of the live
  `namedColorToHex` — it carries the `Object.hasOwn` prototype guard's test.
- **`mergeIntervals`/`gatherOverlaps`'s padding was documented, not halved.** It
  is per-side, so the default merge window is 10kb rather than 5kb; three
  callers depend on today's spacing.
- **The duplicate codon table was collapsed by inverting a dependency, not by
  the obvious route.** `geneticCodes.ts` imported `generateCodonTable`/`revlist`
  FROM `seqUtils.ts`, so defining `codonTable` from `getGeneticCode(1)` there
  would make a module-level const depend on a cycle. `revlist` went to its own
  module and `generateCodonTable` into `geneticCodes.ts` beside its only caller.

## Open: latent / typing / contract

- `renameRegions.ts:18` returns a dead MST node typed as a live `Region`. Every
  caller then reads properties off it, which MST refuses. Not reproduced in
  practice — a worker gets plain objects, so `isStateTreeNode` is false there —
  and fixing it means deciding whether the region is dropped (changing the
  returned array's length, which positional callers rely on) or replaced.
- `renderToStaticMarkup` drops rgba alpha rather than converting it. Now
  explained and pinned by tests; rewriting `fill="rgba(r,g,b,a)"` into
  `fill="rgb(r,g,b)" fill-opacity="a"` would preserve the appearance and let
  `CrossHatches` / `MultiWiggleOverlayLines` drop their workarounds, but it
  changes exported pixels, so it needs a visual pass before regenerating
  snapshots.
- `fileHandleStore.ts` has no delete path, so handles accumulate in IndexedDB
  forever. Wiring deletion to a lifecycle (track removal? session close?) is a
  design decision, not a mechanical fix. (The permanently-cached rejected
  `openDB` is fixed.)
- `useFocusOnInteraction` is bubble-phase, so a child's `stopPropagation`
  suppresses focus-on-click (menus, error bars). The comment now says so.
  Switching it to `{ capture: true }` would make focus survive those and let
  `ResizeHandle` drop its `data-gesture-owner` accommodation — a deliberate
  behavior change, not a bug fix, so it was left alone.
- `util/io` no longer imports the barrel directly, but still reaches it
  transitively through `tracks.ts` and `types/index.ts`. **Cycles here are not
  theoretical** — `tracks.ts` re-exporting `getFileName` after its
  `../configuration` import produced exactly this failure
  (`Cannot read properties of undefined`), fixed by ordering the re-export first
  and guarded by `FileHandleRestoreBanner.test.tsx`.

## Dead code: still open, gated on the plugin ABI question, not on reachability

`@jbrowse/core/util` and `@jbrowse/core/util/layouts` are both in
`ReExports/list.ts`, so everything they export is reachable by an external
runtime plugin through `jbrequire`. The audit's reachability grep was in-tree
only, so "dead" there means "dead in this repo", not "dead". The deletions that
landed crossed that surface knowingly — they are obscure helpers, and
[PLUGIN_ABI_STABILITY.md](PLUGIN_ABI_STABILITY.md) is explicit that RFC-001
deferred formal API-stability policy. The two items below are bigger and were
left for a deliberate call:

- `layouts/` — only `GranularRectLayout.addRect` has an in-tree caller
  (`plugins/canvas/src/LinearBasicDisplay/layout.ts`, on a layout built fresh
  per pack). Dead in-tree: `MultiLayout.ts`, `PrecomputedLayout.ts`,
  `intervalUtils.isRangeClear` (its live twin is hand-inlined in
  `GranularRectLayout.ts`), `BaseLayout` as an implemented interface,
  `serializeRegion`/`toJSON`/`discardRange`/`getByCoord`/`getByID`/
  `getDataByID`/`getRectangles`/`getTotalHeight`/`maxHeightReached`/public
  `addRectToBitmap`, the `Rectangle<T>` generic and both data fields, and the
  unreachable `hardRowLimit` throw. Roughly 400 of 700 lines. This is the one
  layout API an external plugin plausibly reaches for.
- `wheelZoom.ts` — nine exports internal to `createWheelZoomController` sit in
  the barrel with no barrel consumer (every in-tree caller imports the
  `util/wheelZoom` subpath directly). `createScrollLatch` likewise. Low external
  risk (both are recent), but removing them from the barrel is the same kind of
  change.

Also still open: `bpUtils`'s span helpers
(`bpToPx`/`bpSpanPx`/`featureSpanPx`/`MinimalRegion`), three `mst-reflection`
exports, `geneticCodes.ncbiGeneticCodes`, the remaining ~13 unused
`color-bits`/`colorBits` exports. Note `index.ts` exports the **dead**
`bpUtils.bpToPx` under the same name as the live `Base1DUtils.bpToPx` — a
public-surface collision where the exported one is unused.

## Open: structural

- `getRed/getGreen/getBlue/getAlpha` (0xRRGGBBAA) and
  `abgrRed/abgrGreen/abgrBlue/abgrAlpha` (ABGR u32) are both
  `(c: number) => number`; every call site is correct, but the wrong pair
  silently swaps R and B. Both families now cross-reference each other in
  comments. **A branded type was considered and rejected**: ABGR values are read
  back out of `Uint32Array`s, where indexing yields `number`, so every read would
  need the cast that defeats the brand. An `rgbaRed…` rename is still available
  but touches ~200 call sites in the vendored `color-bits`, where upstream names
  have sync value.
- The five `cssColorTo*` wrappers each parse once and destructure differently;
  they are five purpose-named functions over one shared parse, not duplication.
  Only worth collapsing if a hot path is found calling two of them on the same
  string — none was.

## Verified clean (do not re-investigate)

- `crypto.ts` pure-JS fallback matches Node byte-for-byte: MD5, SHA-256
  (including the 55/56/119-byte padding boundaries), AES-256-CBC at
  0/5/16/30/31-byte plaintexts, and the full OpenSSL `Salted__` round-trip. Only
  nit is `getRandomBytes` silently degrading to `Math.random()`.
- `linkify.ts` is not an XSS hole — the URL class excludes `'`, the scheme is
  restricted, and `SanitizedHTML.tsx` runs it before DOMPurify.
- `color/cssColorsLevel4.ts` table itself is complete and correct (148 names,
  exact match against the CSS Color 4 list).
- MST swallows exceptions thrown from `beforeDestroy`, so
  `TimeTraveller.beforeDestroy` calling an undefined disposer was a silently
  swallowed `TypeError`, not the aborted destroy chain it first looked like.
  Measured, not assumed.
- The three `shorten()`s were a name collision, not duplication — now
  `truncateLabel` and `snippetAround`.
