# packages/core/src/util audit — findings and next steps

Audit of `packages/core/src/util/` (2026-07-31), six parallel read-only passes
over disjoint subsets. Everything below was verified by reading the code and
grepping call sites. No reachable bugs are left open, and most of the
latent/typing items and the unambiguous dead code have landed. What remains is a
short latent list, the dead code that sits behind the runtime-plugin ABI
surface, and the structural section.

## Fixed in the second pass (2026-07-31)

Every item that was under "Open: reachable bugs" landed, plus most of
"latent / typing / contract", all with tests:

- `assemblyConfigUtils.getFilename` deleted; `tracks.getFileName` moved to its
  own `getFileName.ts` (dependency-free, so the pure form helpers can use it
  without dragging in MST) and re-exported from `tracks.ts`. Its extension table
  now shares three named constants with the sequence plugin's guessers, so
  `.fas`, `.mfa`, `.FA` and `.fa.bgz` place. `LocalFileChooser`'s and
  `plugins/wiggle`'s copies were deliberately left: the first shows the *full*
  local path and returns `undefined` for "no file", the second takes a string.
- `addAndShowTrack` only shows the track when `addTrackConf` returned a conf.
- `ObservableCreate` errors its subscriber with an abort error when the stop
  token stops (it cannot interrupt `func`; a long synchronous body still needs
  its own `checkStopToken` ticks).
- `fetchAndMaybeUnzip` passes `opts.statusCallback` through instead of
  defaulting it, restoring generic-filehandle2's `res.arrayBuffer()` path, and
  bridges `opts.stopToken` to the read's signal.
- `parseHex` validates; `parseCssColor`'s magenta sentinel is now reachable for
  `#`-prefixed garbage.
- `tabix.extractType` and `groupLinesByRef` no longer lose a line's last
  character to a `-1` end offset. A tab-free line is skipped rather than
  published through `getRefNames`.
- `useFetch` seeds `isLoading` from the key, and `mutate` is synchronous (the
  promise resolved before the refetch it scheduled, so awaiting it was a lie).
  `GetSequenceDialog` now reads `isLoading` instead of hand-rolling it.
  `RefNameInfoDialog`'s `refNames === undefined` stays — it is narrowing, not a
  workaround.
- the jexl `alpha`/`hsl`/`colorString` functions take and return CSS color
  strings, so the published catalog examples work and compose.
- `isAuthNeededException` checks only the name.
- `markStopTokenStopped` deletes before re-setting, so the TTL sweep can't be
  permanently short-circuited.
- `RemoteFileWithRangeCache.clearCache` resumes its queued waiters instead of
  dropping them (a dropped resolver is a hang, not a cancellation), and `stat()`
  goes through `limitConcurrency`.
- `resolvePlugin` returns an undefined `definition` instead of throwing when a
  per-version-only entry matches nothing; `PluginCard` leaves Install disabled.
- `getContentBlocksPxSpan` passes each block's `displayedRegionIndex` through.
- `updateStatus` / `withProgress` / `parseLineByLine` clear their status label in
  a `finally`.
- `namedColorToHex` / `isNamedColor` use `Object.hasOwn`.
- `renameRegionsIfNeeded`'s `Object.fromEntries` is annotated, so `refNameMap`
  and `getSeqAdapterRefName` are checked.
- `fileHandleStore` drops a rejected `openDB` promise rather than caching it.
- `springAnimate` guards its `cancelAnimationFrame`, honors an explicit
  `precision: 0`, and its dropped-frame comment matches the code.
- `mergeIntervals`/`gatherOverlaps`'s `w` is renamed `padding` and documented as
  per-side (so the default merge window is 10kb, not 5kb). Not halved: three
  callers depend on today's spacing.
- `getTrackAssemblyNames`' permanent WeakMap is gone — every caller reads it from
  a reactive getter or autorun, so the memo meant editing `assemblyNames` in the
  config editor never invalidated. MobX's own computed caching covers it.
- `showTrack` no longer builds and discards a whole config node to validate a
  conf that is already a state tree node (MST validated it on creation, and
  `configSchema.create`'s preProcessSnapshot re-ran `Core-preProcessTrackConfig`
  on a snapshot `showTrack` had just preprocessed). An inline conf still gets it.

Outside `util/` but found on the way:

- `BaseSession.setSelection` unwraps a `jexlFeatureProxy`. `isFeature` accepts a
  proxy, but the `Feature` it narrows to promises a callable `id()` and on a
  proxy `id` is a data field — five readers doing
  `isFeature(selection) ? selection.id() : …` threw once one reached the
  selection, which `SVInspector` does through `defaultOnChordClick`.
- `jbrowse add-track x.gtf.gz` wrote a `GtfAdapter` (whole-file) for a file with
  a tabix index beside it; the CLI guesser now routes it to `GtfTabixAdapter`
  like the browser, and knows bedGraph. The AllVsAll / MCScanBlocks /
  BlastTabular entries the audit wanted are hint-only in the browser too, by
  design — `--adapterType` is the intended path, not an extension guess.

## Fixed in the first pass

- `numericUtils.ts toLocale` grouped separators from the end of the whole
  string, so any non-integer >= 1000 was corrupted (`2345.67` -> `"2,345,.67"`,
  `1e21` -> `"1e,+21"`, `Infinity` -> `"In,fin,ity"`). Reached through
  `bpUtils.getTickDisplayStr`, which feeds it `parseFloat(x.toFixed(2))`, so a
  >1 Gbp chromosome rendered scalebar and dotplot-axis ticks as `3,088,.27M`.
  The integer hot path is unchanged and benchmarked identical (still ~2x
  `toLocaleString`); only a `Number.isInteger` branch was added.
- `bpUtils.getBpDisplayStr` chose its unit before rounding, so 999,500-999,999
  rendered `1,000Kbp` instead of `1Mbp`.
- `copyToClipboard.ts` / `copyText.ts` reported success unconditionally: the
  secure-context path was `void navigator.clipboard.writeText(...)` returning
  `true` without awaiting, and `copyText` discarded the `execCommand` boolean.
  Now `copyToClipboard` is async and signals failure one way (throw).
  `copyTextWithSession` was split out for callers holding a session rather than
  a model. The dynamic import was dropped — it bought ~1.5KB, and the module is
  not reachable from the util barrel, so a separate chunk was a net loss.
- `TimeTraveller.initialize()` was not idempotent but re-runs on every
  `setSession` (`HistoryManagement` autorun reads `asRoot(self).session`). It
  overwrote `snapshotDisposer` without disposing, and skipped its baseline once
  `history` was non-empty — and `history` is volatile while `undoIdx` is a
  persisted prop, so Ctrl+Z after a session switch applied the *previous*
  session's snapshot to the new one.
- `SvgCanvas.fontAttrs` matched size/family mid-string and dropped the weight and
  style tokens ahead of them, so every `bold Npx ...` label (MAF codons via
  `FONT_CONFIG`, alignment read labels) exported at regular weight.
- `color-bits/format.ts rgbToHSL` selected its saturation formula on the max
  channel instead of on lightness, understating saturation whenever max > 0.5
  and lightness < 0.5 (`#0a0ac8` came out `63.3%` vs. the true `90.5%`).
  Reachable through the documented jexl `hsl()`.
- `color/makeContrasting` grew its coefficient without bound while MUI's
  lighten/darken clamp it at 1, so a background whose luminance makes 3:1
  unreachable froze the render thread. Measured against `defaultRefNameColors`:
  38/40 hang on a `#b0b0b0` paper, 39/40 on `#a0a0a0`; best reachable ratio
  there is ~2.2. Latent only because default MUI papers are `#fff`/`#121212`,
  and `Ruler.tsx`'s `try/catch` cannot catch a spin.

## Open: latent / typing / contract

Most of this section landed. What is left:

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
- `io/RemoteFileWithRangeCache.ts` — `joinChunk`'s comment promises one
  duplicate fetch where the retry issues one per joined chunk.
- `fileHandleStore.ts` has no delete path, so handles accumulate forever. (The
  permanently-cached rejected `openDB` is fixed.)
- `ResizeHandle.tsx:49` hand-rolls rAF coalescing with no unmount cleanup,
  duplicating `useRafCommit` from the same directory.
- `useFocusOnInteraction` is bubble-phase, so a child's `stopPropagation`
  suppresses focus-on-click (menus, error bars). The comment now says so.
  Switching it to `{ capture: true }` would make focus survive those and let
  `ResizeHandle` drop its `data-gesture-owner` accommodation — a deliberate
  behavior change, not a bug fix, so it was left alone.
- Value cycles through the util barrel (rollup TDZ shape): `openFeatureWidget.ts`
  imports values from `./index.ts`, which re-exports it, and `io/index.ts`
  imports `isElectron, isNode` from `../index.ts`, dragging the whole barrel into
  anything importing `@jbrowse/core/util/io`. Moving `isElectron`/`isNode`/`rIC`
  into a small `environment.ts` next to `isWebWorker.ts` breaks both. (The
  `offscreenCanvasPonyfill` leg is gone with its dead code.) **These are not
  theoretical** — `tracks.ts` re-exporting `getFileName` after its
  `../configuration` import produced exactly this failure
  (`Cannot read properties of undefined`), fixed by ordering the re-export first
  and guarded by `FileHandleRestoreBanner.test.tsx`.

## Dead code: deleted in the second pass

`compositeMap.ts`, `blobToDataURL.ts`, `transferables.ts`, `flatqueue/` (with
`Flatbush.neighbors()` and `upperBound`), the dead half of
`offscreenCanvasPonyfill.ts` (which also breaks one of the barrel's value
cycles), `aborting.ts`'s three pre-stopToken helpers, `nanoid`'s custom-alphabet
machinery, `color-bits`'s `formatHWBA`/`toHWBA`, and the single exports
`blockToRegion`, `makeDisplayedRegionKey`, `isContainedWithin`, `iterMap`,
`getLayoutId`, `contrastingTextColor`, `seqUtils.defaultStops`,
`assembleLocStringFast`, `checkStopToken2`. `getUriLink` and
`shareSessionToDynamo` became module-private.

Two were deliberately kept against the list:

- `Base1DUtils.offsetBpToPx` — three neighbouring comments name it as the
  exact-round-trip answer to a documented precision trap. Deleting the function
  makes that documentation dangle.
- `color/index.isNamedColor` — the one-line sibling of the live
  `namedColorToHex`, and it carries the `Object.hasOwn` prototype guard's test.

## Dead code: still open, gated on the plugin ABI question, not on reachability

`@jbrowse/core/util` and `@jbrowse/core/util/layouts` are both in
`ReExports/list.ts`, so everything they export is reachable by an external
runtime plugin through `jbrequire`. The audit's reachability grep was in-tree
only, so "dead" there means "dead in this repo", not "dead". The deletions above
crossed that surface knowingly — they are obscure helpers, and
[PLUGIN_ABI_STABILITY.md](reference/PLUGIN_ABI_STABILITY.md) is explicit that
RFC-001 deferred formal API-stability policy. The two items below are bigger
and were left for a deliberate call:

- `layouts/` — only `GranularRectLayout.addRect` has an in-tree caller
  (`plugins/canvas/src/LinearBasicDisplay/layout.ts:1135`, on a layout built
  fresh per pack). Dead in-tree: `MultiLayout.ts`, `PrecomputedLayout.ts`,
  `intervalUtils.isRangeClear` (its live twin is hand-inlined at
  `GranularRectLayout.ts:283`), `BaseLayout` as an implemented interface,
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
`color-bits`/`colorBits` exports, and `when.ts` (a one-line re-export of mobx's
`when`, two consumers). Note `index.ts` exports the **dead** `bpUtils.bpToPx`
under the same name as the live `Base1DUtils.bpToPx` — a public-surface
collision where the exported one is unused.

## Open: structural

- `util/index.ts` is a 657-line grab-bag. `reorder` + `ReorderDirection` already
  have their own `reorder.test.ts`; `pluralize`/`capitalizeFirst` belong in
  `stringUtils.ts`; `measureGridWidth`/`resolveSelectedIds`/`getStr` are MUI
  DataGrid helpers that drag an `@mui/x-data-grid` import into the barrel;
  `stringify` belongs next to `assembleLocString` in `locString.ts`;
  `isElectron`/`isNode`/`rIC` belong in `environment.ts` (see the cycle item —
  one of its three legs is already gone with the ponyfill trim).
- Duplication to collapse: two standard codon tables — all 27
  `ncbiGeneticCodes` entries were spot-checked against NCBI `gc.prt` and are
  correct, so `seqUtils.defaultCodonTable`/`codonTable` can be defined as
  `getGeneticCode(1).codonTable`, deleting a 65-line literal (keep the
  `codonTable` name, 11 non-test consumers). **Tried and backed out**:
  `geneticCodes.ts` already imports `seqUtils.ts`, so defining `codonTable` from
  `getGeneticCode(1)` makes a module-level const depend on a cycle — the exact
  load-order failure the `tracks.ts` re-export just produced. `geneticCodes.test.ts`
  already asserts the two tables are equal, so the drift risk is covered.
  Three unrelated `shorten()`s. Five re-parsing `cssColorTo*` wrappers. (The `getFileName` copies are down to the
  two that are not actually duplicates: `LocalFileChooser`'s shows the *full*
  local path and returns `undefined` for "no file", and `plugins/wiggle`'s takes
  a string.)
- `getRed/getGreen/getBlue/getAlpha` (0xRRGGBBAA) and
  `abgrRed/abgrGreen/abgrBlue/abgrAlpha` (ABGR u32) are both
  `(c: number) => number` exported from one barrel; every current call site is
  correct, but the wrong pair silently swaps R and B with no type error. A
  branded type or an `rgbaRed…` rename removes the footgun.
- `products/jbrowse-cli/src/commands/add-track-utils/adapter-utils.ts` is a
  separate guesser table that has drifted: no bedGraph, `BlastTabularAdapter`,
  `GWASAdapter`, `Ldmat`/`PlinkLD*`, `MCScanBlocksAdapter`,
  `StarFusionAdapter`, `AllVsAll*PAFAdapter`, and it routes `.gtf.gz` to
  `GtfAdapter` where the browser uses `GtfTabixAdapter`.

## Verified clean (do not re-investigate)

- `crypto.ts` pure-JS fallback matches Node byte-for-byte: MD5, SHA-256
  (including the 55/56/119-byte padding boundaries), AES-256-CBC at
  0/5/16/30/31-byte plaintexts, and the full OpenSSL `Salted__` round-trip. Only
  nit is `getRandomBytes` silently degrading to `Math.random()`.
- `linkify.ts` is not an XSS hole — the URL class excludes `'`, the scheme is
  restricted, and `SanitizedHTML.tsx:109` runs it before DOMPurify.
- `color/cssColorsLevel4.ts` table itself is complete and correct (148 names,
  exact match against the CSS Color 4 list).
- MST swallows exceptions thrown from `beforeDestroy`, so
  `TimeTraveller.beforeDestroy` calling an undefined disposer was a silently
  swallowed `TypeError`, not the aborted destroy chain it first looked like.
  Measured, not assumed.
