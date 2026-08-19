---
name: handoff-v5-announcement-audit
description: A ten-lane read of the v5.0.0 announcement draft against the code, run after the eight-lane triage. Fifteen claims are false, six sets of numbers are wrong, and the counts behind the ABI paragraph are right. Read before editing the draft or re-checking any claim in it.
---

# Handoff: the v5.0.0 announcement audit

Ten subagents each took one section of
`website/release_announcement_drafts/v5.0.0.md` and checked every claim in it
against the tree at `12f051846a`. This is the second pass over that draft;
`handoffs/v5-release-triage.md` records the first, whose lanes were commit churn
and which already corrected nineteen claims. What is below survived that pass or
arrived after it.

Nothing here is actioned. The draft still carries every claim in the two lists
that follow.

**A claim about a whole list is where this draft goes wrong.** Eight of the
fifteen falsehoods are a sentence naming several things — eight track types,
five pinnable settings, three named modes — where most hold and one or two do
not. Checking the head of such a list confirms nothing about it. The two
universals (`every track`, `everywhere`) both failed, and both are contradicted
by a file already in `agent-docs/`.

## False

Ordered by what a reader loses.

1. **"Every track now uploads its data to the GPU once… zooming and panning no
   longer re-fetch."** Alignments and dotplot hold. Wiggle refetches on any
   `bpPerPx` change (`WiggleScoreConfigMixin`, decided in adr-008), the variant
   matrix uses the same strict rule, MAF and Hi-C refetch across a tier or
   resolution step, synteny across a log2 LOD bucket. `LinearArcDisplay` and
   `LinearPairedArcDisplay` compose no `RenderLifecycleMixin` at all and paint
   JSX `path` on the main thread, so "arcs" in that list is wrong outright
   unless it means the alignments band. `ARCHITECTURE.md` §"Per-region
   zoom-staleness" is the canonical list and contradicts the sentence.
2. **"The last stretch of the release was net simplifying… a great deal of code
   came out."** Non-test `.ts`/`.tsx` under `packages|plugins|products` went
   209,728 lines at v4.3.0 to 469,330 at HEAD, monotonically, and the final week
   added 54,003 — the largest weekly gain of the release. `loc_over_time.png`
   sits directly above the sentence showing that rise.
3. **The draft tells plugin authors to call
   `configModel.setSlot('slotName', value)`.** `eslint.config.mjs` bans that
   shape by name: a promotable slot resolves only through `resolveConf`, and
   `setSlot` writes past it. Should be `setConf`.
4. **"the less common toggles moved to an Advanced submenu."** No Advanced
   submenu exists in the alignments plugin. `menus/reads.ts` says grouping the
   menu with subHeaders was tried and reverted. What moved is the row cap, into
   Read height.
5. **"hovering any of it names every connection under the cursor."**
   `hitTestArcBand` returns one winner through `pickBetween` and
   `formatArcTooltip` formats one arc. The plural list nearby is a tick's
   partner refNames, which are chromosomes. `ArcHoverOverlay.tsx` carries a
   stale comment predicting the plural tooltip; the string is not in the tree.
6. **"The import forms… were reworked around a pairwise-vs-pangenome toggle."**
   Both comparative import forms are built around Quick start / Manual
   (`ImportFormModes.tsx`). No import form mentions pangenome. The
   pairwise-vs-all-vs-all distinction the sentence half-remembers is on the
   add-track widget.
7. **"The feature detail panel offers the raw genomic sequence types on spliced
   features."** Reverted by `df54f30f59`, and `SequenceTypeSelector.test.tsx`
   pins the reverted behavior. The crosshair half of the same sentence is real.
8. **"Multi-wiggle gained group-by."** No group-by in `plugins/wiggle`. The
   dendrogram half is real. `rowGroups` belongs to
   `LinearMultiRowFeatureDisplay`; `groupBy` to alignments and variants.
9. **"the chrome follows the theme instead of being dark either way."**
   `dockviewTheme.ts` fixes the strip at `#252526` in both themes and says why:
   a light strip reads as content. The panel body is the part that follows the
   theme.
10. **"an exported figure carries the resolution it was drawn at."**
    `effectiveResolution` is read by the track menu, the overlay select and the
    fetch. The SVG path reads it nowhere, and PNG rasterizes that SVG. The
    legend and its endpoints do export.
11. **"one with Material UI removed entirely."** The page's own source says MUI
    still ends up in the bundle; a walk of the built page finds 38
    statically-reachable `@mui/*` chunks. It is removed from what renders.
12. **"group-by" listed among settings that can be pinned.** `groupBy` is a
    frozen slot with no `promotedBase`, so `promotableSlotNames` never sees it.
    The other four named settings pin. **"Follow default"** is not a label in
    the tree either; un-pinning is the pin again, or the editor's Reset to
    default.
13. **"`heightPreConfig` and `heightOverride`… existed during development."**
    `heightPreConfig` shipped in v4.3.0 and has a live migration today in
    `sessionMigrations`. Only `heightOverride` was development-only.
14. **The Nextstrain example "with a multiple-sequence alignment and tree
    alongside the browser."** It ships annotations, an entropy BigWig and the
    genotype matrix. Its own doc page sends the reader to react-msaview on
    another site for the tree and alignment.
15. **"`&assembly=` and `&loc=` work outside jbrowse-web now"** means desktop.
    Neither react product parses a URL parameter — no `URLSearchParams` in
    either — and `urlparams.md` says so. `&extendSession=` is web-only and
    desktop rejects it with a message.

## Numbers

- `git diff --shortstat v4.3.0..HEAD` at `12f051846a` is **9,166 files,
  +1,011,355, −295,862**. The draft says 9,003 / +975,233 / −249,824; deletions
  are 18.4% under. The REGENERATE marker above it is doing its job.
- **The pan-speedup column has no record.** `reference/RENDERER_BENCHMARKS.md`
  says pan "is not here yet" and warns that the corpus tapers read depth to the
  right, which reads as a speedup in both arms. The zoom column is exact against
  `measurements/zoom-in-refetch.json`.
- **"Opening a track cold is 1.3× to 2.2× faster"** is contradicted by that same
  file, which calls the cold-load table unusable as measured and says to re-run
  before quoting.
- **CRAM "three cases".** `@gmod/cram` v13.3.0 is installed, but v13.0.0 carries
  one change; the samtools-parity work landed across v10.4.1–v12, and the
  changelog line says four tolerated discrepancies.
- **"the several legacy spellings of automatic height"** is one,
  `autoHeight` → `heightMode: 'grow'`. Alignments has no height migration.
  `squeezeToDisplayHeight`, which the canvas docstring names, never shipped.
- **"`getFileHandleCache` and its six siblings"** is seven, and `util/tracks` is
  missing two of the eight names, not one.

## Right, including where it was worth doubting

- **The ABI paragraph's counts.** Parsed independently: 53 entries, 46 unique
  names, 7 double-served, and the seven are the pairs the prose implies.
  `abiPreviousRelease.test.ts` passes 16/16 against a committed tarball snapshot
  of published v4.3.0. `check-published-plugins.ts` run live prints `1 of 14`
  and names Apollo on exactly the three symbols quoted.
  **Its bullet list is the defect: six groups cover 29 of the 46.** Seventeen
  names sit in `KNOWN_REMOVALS` under groups the prose dropped, and
  `isContainedWithin` is one of them while being named as an Apollo break two
  paragraphs later.
- **`significanceLine` on the plot's own scale.** Maps onto the transformed
  domain; the -log10 is an opt-in adapter transform, so the Fst reading is real.
- **D′ and r² computed live.** Lewontin normalization correct in both signs,
  with a parity test carrying an independent D′ oracle.
- **`runClustering` for all three named kinds**, each with its own autorun test,
  plus a fourth the sentence omits. This was the likeliest place for a silent
  gap and there is none.
- **The interchromosomal support floor** derives from the library's own
  MAD-based insert-size band, with `DEFAULT_INTERCHROM_WINDOW_BP` only as a
  fallback, and requires agreement on both contigs.
- **NCBI genetic-code tables** 2 and 4 exact against `gc.prt`, all 26 present;
  `transl_except` parses all three NCBI syntaxes; HGVS `c.`/`n.` has
  known-answer tests for intronic, UTR and minus-strand.
- **The dendrogram at scale**, pinned by a 50,000-tip single-linkage
  caterpillar; every traversal iterative, the old failure recorded as a stack
  overflow past ~5,000 tips.
- **The share link resolving a pin rather than shipping the preference**
  (`bakePromotedDefaultsIntoSnapshot`), which documents its own gap: a slot the
  sender viewed at base is not baked.
- **Cancel genuinely aborts.** `markStopTokenStopped` calls `controller.abort()`
  on every registered controller, with a worker broadcaster for the cross-thread
  case.
- **The region-too-large budget** widens below `AUTO_FORCE_LOAD_BP = 20_000` by
  `SUB_FLOOR_BYTE_BUDGET_FACTOR = 2`, and `forceLoad` is read.
- **The polyprotein-CDS-reads-as-non-coding issue is closed**, replaced by a
  recursive `isCodingFeature` and pinned by a test naming the polyprotein case.

## Two that nothing in-repo can settle

**`loc_over_time.png` has no generator.** Tracked as a hash in `figures.lock`,
committed as bytes beside the draft in `683b3c5e07`. No autogen entry, no
`cloc`/`tokei` script anywhere. Its caption names tokei and a 388-week span
without recording the invocation. Every other figure in the post is either a
screenshot spec or a jbrowse-img recipe; this is the one the release process
cannot re-derive.

**The two-tier benchmark marker still cannot be filled.** Confirmed against
what `v5-release-triage.md` already recorded:
`measurements/pif-coarse-tier-bytes.json` is `hand` and holds on-disk size
ratios, not download bytes or time-to-settle.
Needs a measured whole-genome pair or the paragraph stands without numbers.

## Also found, outside the draft

- **`jbrowse validate` reports 7 errors across 4 of the 132 repo configs.** Two
  files are deliberate fixtures. Two are not: `demos/hg002/config-chr22.json`
  puts `sequenceAdapter` inside a `CramAdapter` on two tracks, and
  `test_data/volvox/config.json` track 90 names `volvox_del2`, which nothing
  defines. Docs examples pass — `check-config-blocks.ts` exits 0.
- **"Every figure documents how to reproduce it"** is 310 of 329: 279
  autogenerated, 31 jbrowse-img, 19 manual. Eight of the 19 are actually
  produced by the Selenium desktop run and mislabelled, because
  `audit-figures.ts` does not consult `desktop-figures.ts`. Truly hand-made: 11,
  all architecture diagrams. The three Desktop figures in this announcement are
  among those the manifest calls manual.
- **The eager-bundle measurement has no gate.** `measureEagerBundle.mjs` exists
  and appears in no workflow and no autogen entry, so the shader-out-of-the-
  startup-chunk property behind the lazy-loading paragraph is unenforced. The
  chrome bundle size beside it is gated, on every push.
- **`abiPreviousRelease.test.ts`'s own header comment says "6 of 17"**, stale
  against the live run's 1 of 14. The announcement is the correct one.
- **The three-quietly-failing-surfaces count** contradicts
  `reference/PLUGIN_ABI_STABILITY.md` and root `CLAUDE.md`, which both say two.
  The draft's third is behaviourally real: `addToExtensionPoint` does no runtime
  name check, so a prebuilt v4 bundle still drops other plugins' entries. The
  reference docs are the side that should move.
- **`parseRecords` is attributed to the GFF3 adapters** and belongs to
  `gff-nostream`; the tabix adapter calls `parseRecordsLazy` and `Gff3Adapter`
  calls `parseLinesLazy`. The `{ feature, record }` shape and the byte-offset id
  are both right.
- **The old alignment display types resolve through registered aliases plus a
  settings migration**, not "because relocated types kept their registered
  name". The outcome the draft promises holds; the mechanism it names does not.
