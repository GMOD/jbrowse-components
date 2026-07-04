# JBrowse simplification sweep — handoff

Goal: continued simplifications / refactors / bugfixes. Started in `plugins/canvas`,
expanded codebase-wide via 6 parallel analysis agents. This doc captures what's
**already applied + verified**, what **remains** (prioritized, execution-ready),
and what was **deliberately left alone** so nobody re-investigates it.

Conventions for executors:
- Per-plugin typecheck: `npx tsgo --build plugins/<p>/tsconfig.build.esm.json`
  (NOT `tsc`, NOT `tsgo -p`). Core pkgs: `packages/<p>/tsconfig.build.esm.json`.
- Tests: `pnpm test <dir>` (scoped, never full suite).
- Style rules that void a "simplification": no `any`/typecasts; no early-return
  (nest/ternary); scrutinize `||`/`??`; pure functions; `observer()` always;
  no per-feature ctx in hot loops; "complexity not LOC".

---

## ✅ APPLIED + VERIFIED (do not redo)

### canvas (typecheck clean; 162 canvas + 148 LGV tests pass)
- **BUGFIX** `LinearBasicDisplay/components/ColorByAttributeDialog.tsx` — validate
  generated jexl via `stringToJexlExpression`; `ErrorMessage` + Apply disabled on
  parse failure. Prevents a quote/backslash in the attribute name committing
  malformed jexl.
- **DEDUP+correctness** `LinearMultiRowFeatureDisplay/fetchMultiRowFeatures.ts` —
  now delegates to shared `fetchEachRegion` (per-result stale guards) instead of
  a hand-rolled `Promise.all`.
- **DEDUP** `RenderFeatureDataRPC/collectRenderData.ts` — extracted
  `emitSubfeatureLabel` helper, collapsed 2 near-identical ~25-line blocks
  (transcript + mature-protein paths).
- **DEDUP** `MIN_DISPLAY_HEIGHT` — now exported from
  `linear-genome-view/.../TrackHeightMixin.tsx`, re-exported via both indexes,
  consumed by multi-row model (was a duplicated local `minDisplayHeight = 20`).
- **DOC FIX** `LinearBasicDisplay/baseModel.ts` `featureColor` getter comment
  (it's deliberately override-only; reading the config slot would evaluate jexl
  w/o a feature and throw).

### dead-code batch (typecheck clean; variants 29 tests pass)
- `alignments/src/shared/collectTransferables.ts` — removed unused
  `collectResultTransferables` (kept `addTransferables` + `collectGroupedTransferables`);
  fixed stale comment in `buildCoverageResultFields.ts:19`.
- `linear-genome-view/src/BaseLinearDisplay/models/util.ts` — **deleted** (only
  export `getId` was dead; no importers).
- `variants/src/VcfFeature/util.ts` — removed dead `getSOAndDescFromAltDefs`;
  retargeted its test in `index.test.ts` to the production `getSOTermAndDescription`
  (asserts SO term `[0]`) so symbolic-allele coverage is preserved.

---

### arc SVG chrome dedup (2026-07-04; arc typecheck clean, 8 tests pass)
- **DEDUP** `shared/renderArcSvg.tsx` — the byte-identical `renderSvg.tsx` chrome
  (SvgChrome + SvgClipRect + awaitSvgReady) now lives in one generic
  `renderArcSvg<M>(model, Arcs, opts)`; both displays' `renderSvg.tsx` are thin
  wrappers passing their own `Arcs`. (Plain function share — fine.)
- **NOT DONE (deliberately): ReactComponent dedup.** The handoff proposed a
  `makeArcReactComponent(Arcs)` factory. A component-returning factory is more
  machinery than the trivial wrapper it removes (each body is just
  `<BaseDisplayComponent><Arcs/></BaseDisplayComponent>`) and obscures the
  `lazy(import())` entry point. Left the two explicit `ReactComponent.tsx`
  wrappers — "explicit even if duplicated" wins here.

### TIER 1 status — everything else VERIFIED COMPLETE (2026-07-04)
Re-audited the whole TIER 1 list; all applied or intentionally kept:
circular-view `thetaRangesOverlap` (removed), maf `rowBandGeometry`, alignments
`getUniqueTags`/filter-flags `defaultFilterFlags`, product-core MultipleViews
`move` closure, core `colord` clamp / `measureGridWidth` single-pass /
`sessionSharing` / `getStrokeProps`→`svgColorProps.ts`, sequence
`deriveFastaLocations`, app-core `FAB_Z_INDEX`, tree-sidebar `TREE_STROKE` +
`SvgRowLabels` reduce + canvas resize (now via shared `getPreparedCanvas2D`).
`seqUtils.reverse` kept as an index loop **on purpose** (comment: spread iterator
too slow for large sequences) — no longer a finding.

---

## ▶ REMAINING — TIER 1: (all applied — see above)

### Dead code
- **circular-view** `CircularView/viewportVisibleRegion.ts:39-69` — remove
  `thetaRangesOverlap` (only consumer is its own test). Also delete its block in
  `viewportVisibleRegion.test.ts` (import line 3, test line 74). KEEP `twoPi`
  (used later at ~105, ~171-173).

### Dedup (use an existing helper / collapse copy-paste)
- **maf rowBandGeometry** — `LinearMafRenderer/drawMafBlocks.ts:33-34` and
  `LinearMafDisplay/components/drawRowIdentity.ts:153-154` both inline
  `h = rowHeight*rowProportion; offset = (rowHeight-h)/2`. Import + destructure
  `rowBandGeometry` from `LinearMafDisplay/components/visibleRegionGeometry.ts:27`
  (already used by the 5 computeVisible* files). Once-per-draw, not hot loop.
- **alignments getUniqueTags** `shared/getUniqueTags.ts:28-30` — calls
  `getRpcSessionId(self)` into `sessionId`, then calls it again as the RPC arg.
  Reuse the variable.
- **alignments filter flags** `LinearAlignmentsDisplay/configSchema.ts:130-133` —
  `{flagInclude:0, flagExclude:1540}` duplicates `defaultFilterFlags` exported
  from `shared/util.ts:5`. Import it as the `defaultValue`. (Bonus: `1540` is
  `UNMAPPED|FAILS_QC|DUPLICATE` — could express via `SAM_FLAG_*` from
  `@jbrowse/alignments-core/samFlags.ts`.)
- **product-core MultipleViews** `Session/MultipleViews.ts:50-83` — 4 identical
  `moveView{Down,Up,ToTop,ToBottom}` differing only by direction literal.
  Extract a local closure in the same `.actions()` block:
  `const move = (id, dir) => { self.views = cast(reorder(self.views, self.views.findIndex(v=>v.id===id), dir)) }`.
  The `if (idx !== -1)` guards are dead — `reorder` (`core/util/index.ts:252`)
  already bounds-checks. Import `ReorderDirection` type.
- **core colord clamp** `core/util/colord.ts:47` — local `clamp` duplicates the
  exported one in `core/util/numericUtils.ts:1`. Delete local, import it.
  (colord.test.ts covers.)
- **core seqUtils reverse** `core/util/seqUtils.ts:47-53` — replace manual
  descending loop with `[...str].reverse().join('')`. Leave `revcom`/`complement`
  (they carry the complement-table lookup). (seqUtils.test.ts covers.)
- **core getStrokeProps/getFillProps** `core/util/index.ts:285,297` — identical
  except key names. KEEP both public exports/signatures; delegate to a private
  same-file `svgColorProps(str, colorKey, opacityKey)`. (Public API — don't
  change signatures.)
- **core measureGridWidth** `core/util/index.ts:223-229` — 4 chained `.map()`
  passes → one single-pass `.map()`. Heuristic, not hot.
- **core sessionSharing** `core/util/sessionSharing.ts` — `bytesToBinaryString`
  (line 3) → `Array.from(bytes, b=>String.fromCharCode(b)).join('')`; `generateUID`
  (line 14) reuse it; `toUrlSafeB64` (76-79) hoist the dup
  `.replaceAll('+','-').replaceAll('/','_')` out of both ternary branches.
  (sessionSharing.test.ts covers.)
- **tree-sidebar resizeCanvas** `treeDrawingAutorun.ts` ~44-52 & ~118-124 — both
  do guarded `canvas.width/height` assign + `getContext('2d')` null-guard.
  Extract `resizeCanvas(canvas, w, h)` taking EXPLICIT w/h (draw uses 2× HiDPI,
  hover doesn't — helper must not unify dims).
- **tree-sidebar SvgRowLabels** `SvgRowLabels.tsx:26-30` — mutable-`let` max loop
  → `reduce((m,s)=>Math.max(m, measureText(s.label ?? s.name, fontSize)+10), 10)`.
  (reduce, not spread — avoids call-arg ceiling.)
- **tree-sidebar TREE_STROKE** — `'#0008'` in `SvgTreePath.tsx:17` (SVG) and
  `treeDrawingAutorun.ts:59` (canvas). Extract `export const TREE_STROKE='#0008'`;
  both must stay in sync.
- **arc renderSvg dedup** — `LinearArcDisplay/renderSvg.tsx` and
  `LinearPairedArcDisplay/renderSvg.tsx` are byte-identical except model type +
  which `Arcs` is imported. Move to `shared/renderArcSvg.tsx` typed
  `model: ArcDisplayModel` (`shared/ArcDisplayModel.ts`) taking `Arcs` as a param.
  Update both displays' dynamic `import('./renderSvg.tsx')`.
- **arc ReactComponent dedup** — `LinearArcDisplay/components/ReactComponent.tsx`
  and `LinearPairedArcDisplay/components/ReactComponent.tsx` differ only by model
  type + `Arcs`. Make `shared/makeArcReactComponent(Arcs)` factory returning the
  observer component.
- **sequence deriveFastaLocations** — `IndexedFastaAdapter/configSchema.ts:18` and
  `BgzipFastaAdapter/configSchema.ts:14` both derive `fastaLocation`+`faiLocation`
  from `snap.uri` (Bgzip adds `gziLocation`). Extract plain helper
  `deriveFastaLocations(snap) => {fastaLocation, faiLocation}` (in `chromSizesUtils.ts`
  or new small file); each spreads it, Bgzip adds gzi. (NOT the flag-factory
  variant.) normalizeSnapshot.test.ts covers.
- **app-core AppFab** `ui/App/AppFab.tsx:10,16` — `zIndex:10000` in both rules →
  file-local const.

---

## ▶ TIER 2: low value / optional (apply only if doing a thorough pass)
- **maf tooltip styles (2026-07-04; already stale — no action needed)** — this
  item predates `3ac60c6e36`, which already extracted a shared
  `useTooltipStyles` (`tooltipStyles.ts`) consumed by all three of
  `MafAlignmentTooltipContents.tsx`, `MafCoverageTooltipContents.tsx`, and
  `MafInterbaseTooltipContents.tsx`. Nothing left to dedupe.
- **cigar-utils getNibble (2026-07-04; deliberately skipped)** — considered
  extracting the repeated `(numericSeq[i>>1] >> ((1-(i&1))<<2)) & 0xf` in
  `forEachMismatchNumeric.ts` into a `getNibble(seq,i)` helper. **Not applied**:
  this is the per-base mismatch-walk loop, explicitly comment-flagged in that
  file as running over whole-chromosome contigs (~250M bases); a function-call
  indirection here is exactly what `packages/alignments-core/CLAUDE.md`'s "no
  allocation / verbose-but-zero-alloc wins over DRY" hot-loop rule warns
  against, even for a would-be-inlinable primitive-returning function. Left
  as-is; the other Tier 2 items below (all once-per-feature or non-hot) were
  applied.

### Applied 2026-07-04 (alignments/bed/circular-view typecheck + tests pass)
- **alignments straggler flag literals → SAM_FLAG_*** —
  `executeRenderAlignmentData.ts` `&2`→`SAM_FLAG_PROPER_PAIR`;
  `features/modCoverage/readBaseCounts.ts` `&16`→`SAM_FLAG_REVERSE`;
  `BamSlightlyLazyFeature.ts` & `CramSlightlyLazyFeature.ts`
  `&0x40/0x10/0x20`→`SAM_FLAG_FIRST_IN_PAIR`/`SAM_FLAG_REVERSE`/`SAM_FLAG_MATE_REVERSE`.
- **circular-view twoPi** — `viewportVisibleRegion.ts` now exports `twoPi`;
  `model.ts`'s local redeclaration removed, imports it instead.
- **bed getNames** — `BedAdapter`/`BedpeAdapter` `getNames()` now both call a
  shared `resolveColumnNames` helper in `util.ts`. `BedTabixAdapter` untouched
  (its `getNames` genuinely differs).

---

## ⚠ TIER 3: needs verification or carries risk — DO NOT auto-apply

- **MAF fetch → fetchEachRegion** `maf/.../fetchMafData.ts:40-67` — `fetchMafRegions`
  IS already a clean shared helper (both alignment+summary paths use it), so this
  is marginal, not a hand-rolled per-display dup. Converting entangles the
  once-only `setSamples({samples,treeNewick})` (results[0] → would move into
  per-region `onResult`, idempotent via existing deepEqual guard) and moves
  `clearAlignmentData` to `onComplete`. Correctness-sensitive fetch path
  (`feedback_fetch_autorun_critical`) → **browser-verify** (load MAF, pan/zoom
  multi-region, toggle summary↔detail, confirm samples/tree populate once, no
  stale writes). RECOMMENDATION: skip unless specifically wanted.
- **core published-API dead exports** — agent found these with zero in-repo
  consumers BUT they're re-exported from `@jbrowse/core` public barrels; external
  plugin authors may import them. Removing is a breaking change we can't verify
  safe from here. **Skipped intentionally.** List (if a deprecation pass is ever
  desired): nanoid `customRandom`/`customAlphabet`; mst-reflection `getPropertyType`;
  colorBits `cssColorToRgba`/`cssColorToNormalizedRgba`; colord `hexToGLrgb`;
  range `isContainedWithin`; crypto `sha256Base64`; locString `compareLocStrings`;
  tracks `findFileHandleIds`; aborting `abortBreakPoint`/`observeAbortSignal`;
  mstUtils `hashCode`; tree-sidebar `clusterTree`(fn)/`parseClusterTree`/`leafNameMap`.
- **canvas polyprotein peptides** — `RenderFeatureDataRPC/peptides/peptideUtils.ts:62`
  `findTranscriptsWithCDS` only admits gene/transcript types, so a bare top-level
  CDS or `proteoform_orf` container routed to `MatureProteinRegion` gets no
  peptide entry → the whole `aminoAcidsInRange`/`emitCodonRects` path
  (collectRenderData.ts ~590-680) may be dead for those. **Browser-verify against
  a real polyprotein dataset** before fixing (impact depends on real-world typing).
- **canvas featureColor config slot** — picker swatch ignores an admin-set solid
  `color` config slot (shows default). Correct fix needs a RAW (unevaluated)
  config read + jexl guard (getConfWithOverride evaluates jexl → throws w/o
  feature). Low severity (cosmetic; rendering is correct). Left as-is + comment
  fixed.

---

## ✋ Verified NON-findings (don't chase these)
- wiggle/gwas/hic: already fully adopt `fetchEachRegion` + shared `ScoreScaleModel`.
  HiC sends ALL regions in one RPC → `fetchEachRegion` doesn't apply.
- alignments: NO hand-rolled fetch fan-out; packed-CIGAR bit-twiddling inline by
  design; pair-orientation encoded 3× but as inverse maps in different shapes
  (MODERATE, correctness seam — only touch if already in that code).
- variants: two renderSvg skeletons + two allele counters are intentionally
  context-tuned (see plugins/variants/src/CLAUDE.md); MultiSampleVariant already
  shares via base model.
- `MIN_CIGAR_PX_WIDTH` (comparative=8 vs dotplot=4), `parseStrand` (bed vs
  spreadsheet) — values/semantics differ ON PURPOSE; do NOT merge.
- `createStopTokenRotation`, `bezierConnectorPath`, `makeStatusCallback` all
  already shared + adopted.
- core numericUtils min/max/sum index loops (typed-array ArrayLike + stack-safety),
  d3-style tree walks, SVG-vs-canvas path duplication — all intentional.
