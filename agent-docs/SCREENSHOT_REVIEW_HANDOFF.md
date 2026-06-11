# Screenshot review — handoff / next steps

Tracks the website screenshot specs (`website/scripts/screenshot-specs.ts`)
flagged `bad` in `website/scripts/screenshot-review.json` (the review file is
**gitignored** local state, not committed; it's the source of truth for what's
still open and carries the reviewer's per-spec `note`).

## How to regenerate

```
cd website && pnpm generate-screenshots --filter=<name> --exact
```

- Output lands in `website/static/img/<name>.png`; on failure a
  `debug_<name>.png` is written alongside (read it to see where a click landed).
- Generation serves the prebuilt `products/jbrowse-web/build` — **rebuild
  jbrowse-web** (`cd products/jbrowse-web && pnpm build`) after any app-source
  change (e.g. a new `data-testid`) before the testid shows up in a capture.
- Multiple agents serialize the edit-spec + regenerate critical section through a
  shared mkdir-based lock (`bash /tmp/jb-shot-lock.sh acquire|release`) so they
  never collide on the single generator port (3334) or on `screenshot-specs.ts`.

## Gotchas (durable)

- hg19 in config_demo displays the refname as `1` (no `chr`) in the ruler, but
  `loc` and `readyText` accept `chr1`-style too (refNameAliases). For specs that
  start with **no tracks**, wait on a menubar/UI string (e.g. `Open track
  selector`), not a chromosome label.
- Right-click/coordinate clicks are width-sensitive: changing `viewportWidth`
  moves genomic columns, so recompute `from.x`. The generator default viewport is
  1500×800 at deviceScaleFactor 2 (PNGs are 2×). Prefer a stable `data-testid`
  over coordinate clicks (canvas features expose `feature-name-<name>` /
  `feature-desc-<name>` floating-label testids; variants included).
- Display config overrides (`showDescriptions`, `defaultRendering`, `autoscale`,
  `colorBy`, `minScore`/`maxScore`, `minSashimiScore`, `colorBySetting`, …) can be
  set **flat** inside `displaySnapshot` — a preProcessSnapshot collects declared
  config keys into the override map. **But** flat `displaySnapshot` overrides on a
  **sessionTrack** don't reliably apply (the alignments `userByteSizeLimit` /
  density-guard fields didn't stick on a sessionTrack; they DO on config tracks —
  see `multi-sv-trio`). Use a config track (or accept the FORCE-LOAD prompt /
  drop the track) for per-display overrides on session tracks.
- The alignments **feature-density / byte guard** has TWO gates:
  `bytesTooLarge` (raise `userByteSizeLimit`) **and** `densityTooLarge` (raise
  `userBpPerPxLimit`). Dense long-read pileups (116x PacBio) trip the density
  gate even under the byte limit.
- Whole-genome `showAllRegionsInAssembly` (no-loc view init) **races** a slow
  remote assembly load and silently no-ops. To show all chromosomes reliably,
  pass an explicit multi-region `loc` (space-separated, like the synteny specs):
  `loc: 'chr1 chr2 … chrX chrY'` — `navToLocString` opens them all. See
  `sv_cgiab/cnv_multi_bigwig`.
- A `MultiQuantitativeTrack` can wrap a **single** `BedTabixAdapter`/
  `BedGraphAdapter` (bedMethyl, bedgraph): the multiwiggle RPC groups its
  `getFeatures` by the per-feature `source` field. (This was a webgl-poc
  regression — `executeRenderMultiWiggleData` now restores the group-by-source
  fallback.) `generateBedMethylFeature` sets `source` = the modkit mod code.
- Synteny/dotplot from a tabix `.pif.gz` needs **`PairwiseIndexedPAFAdapter`**,
  not a plain `PAFAdapter` — `PAFAdapter` doesn't strip the PIF `q`/`t` refName
  prefixes, so refNames never match the assembly and the view renders **blank**.
  (The cgiab config ships the wrong adapter; the specs override it.)
- The arc-band read cloud (samplot) uses a **base-2 log** Y scale
  (`arcYFraction` in `features/arcs/arcYScale.ts`, shared by shader uniform
  `arcsYLog`, Canvas2D, and the insert-size ruler ticks). Don't reintroduce a
  linear samplot Y.
- `clickElement()` force-clicks (dispatches `node.click()`) when the resolved
  element's center is covered by an overlay, else does a real mouse click.
- The hierarchical track-selector tree is **react-window virtualized**: a
  category below the fold isn't in the DOM. Use a tall `viewportHeight` and/or a
  visible category. The category "…" menu now has a stable testid
  `htsCategoryMenu-<name>` (added to **both** label variants in
  `TrackCategory.tsx`); the shopping cart is `hts-shopping-cart`.

## Data generation notes

- **`goleft indexcov`** estimates genome-wide coverage from a BAM `.bai` index in
  **seconds** (no read download). Used to make the HG008 normal/tumor coverage
  bigWigs for the cgiab CNV figures. Recipe: download the two `.bai` + the
  `.fa.fai`; make header-only BAMs (`samtools view -bH <remote> > x.bam`) so
  indexcov can read chrom names; `goleft indexcov --directory out x.bam y.bam`;
  split the `out/*-indexcov.bed.gz` columns into per-sample bedgraphs (clamp bin
  end to chrom size, `LC_COLLATE=C sort -k1,1 -k2,2n`); `bedGraphToBigWig`. Output
  is normalized (median≈1 → reads directly as copy number). Hosted at
  `s3://jbrowse.org/demos/cgiab/HG008-{N,T}_indexcov.bw`.
- hg38 NCBI RefSeq genes are hosted (chr-named, CSI index) at
  `https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz` — matches GRCh38/GIABv3
  refnames directly, no rehosting. (The jb2hubs/genomes.jbrowse.org hub files
  under `jbrowse.org/ucsc/<db>/` are the up-to-date resource; use absolute URLs.)

## Resolved this pass (2026-06-11)

App regressions fixed (committed; needed jbrowse-web rebuild + `pnpm gen:shaders`
for the shader change):

- **`alignments/read_cloud`** — restored the base-2 **log** samplot TLEN Y scale
  across the GPU shader (`arc.slang` `arcsYLog` uniform), Canvas2D draw, and the
  insert-size ruler ticks, via the shared `arcYFraction` helper.
- **`alignment_clipping_indicators`** — clip/insertion interbase bars were baked
  vs the region's raw peak depth but never renormalized onto the display's
  autoscaled coverage domain → too short at SV breakpoints. Multiply
  `interbaseHeight` by `depthScale` (GPU) / `interbaseMaxCount/domainMax`
  (Canvas2D + MAF).
- **bedMethyl `MultiQuantitativeTrack`** (`methylation/colo829_cram_and_bedmethyl`)
  — restored the multiwiggle group-by-`source` fallback for a single non-multi
  adapter (also unbreaks the `bilby`/`bilby2` demo tracks).
- **`alignments/select_arc_display`** — "Show pair overlay" radio submenu →
  two checkboxes ("Show read arcs" / "Show read cloud", mutually exclusive since
  the read cloud repurposes the band Y axis).

Screenshots fixed / authored (committed):

- `multi-sv-trio` — 1KGP Illumina SV VCF + HG02030/31/32 trio reads at the
  inherited deletion (kgUrl + raised `userByteSizeLimit`).
- `methylation/per_read_mod_bam` — COLO829 reads, colorBy all modifications.
- `methylation/colo829_cram_and_bedmethyl` — CRAM methylation + bedMethyl
  MultiQuantitativeTrack.
- `link_to_split_view` — TRA variant feature-details → BREAKENDS "(breakpoint
  split view)" link annotated.
- `sv_cgiab/deletion_linear_view` — chr10:122.82–122.85Mb + the jbrowse.org/ucsc
  hg38 ncbiRefSeq genes + the somatic `<DEL>` call.
- `sv_cgiab/cnv_with_bed_track` — `localsd` autoscaled HG008-N coverage + CNV bed.
- `sv_cgiab/cnv_multi_bigwig` + `sv_cgiab/cnv_score_limit` — whole-genome
  normal-vs-tumor coverage MultiQuantitativeTrack from the indexcov bigWigs
  (second with a `maxScore` cap).
- `sv_cgiab/dotplot_result` + `sv_cgiab/synteny_view` — un-blanked via
  `PairwiseIndexedPAFAdapter`.
- `rnaseq/compact_stacked` — `minSashimiScore: 3` drops the spurious
  forward-strand sashimi arcs (single-/2-read aligner noise; real ACTB
  minus-strand introns have 449/290/29/27/4 reads).
- `methylation/arabidopsis_bisulfite_chh` — navigate to the most CHH-methylated
  window `NC_003070.9:144,001-146,000` (~61% C-retention vs the unmethylated
  default).
- `multiwig/multi_colorselect` — repointed off the dead ENCODE `microarray_multi`
  (403s headless) to the local `volvox_microarray_multi` (k1-k4, red/green/blue).
- `menu_demo` — kept curated: a standalone Menu-component demo matching a code
  listing in `developer_guides/menus.md`, not reproducible app state.

## Still open

- **`multiwig/trackselector`** — IN PROGRESS. Multi-step: a category "…" menu →
  "Add to selection" → shopping cart → "Create multi-wiggle track". Stable
  testids were added (`htsCategoryMenu-<name>` on **both** category-label
  variants in `TrackCategory.tsx`, `hts-shopping-cart` on the cart). Needs a
  jbrowse-web rebuild then a regen targeting a visible category (e.g.
  `htsCategoryMenu-Integration test` with a tall `viewportHeight`, since the tree
  is virtualized). "Create multi-wiggle track" appears for any non-empty
  selection (`isSessionWithAddTracks` gate only — no wiggle-only requirement).
- **`protein/structure`** & **`protein/connected`** — `curated`; require a local
  `~/src/jb2plugins/jbrowse-plugin-protein3d` dev server on PORT 9000
  (`.test-jbrowse-nightly` + `pnpm start`). Spec format is correct; drop
  `curated` with that server running to reshoot. AlphaFold structure loads
  remotely.
- **`desktop-session`** — desktop autogen (Selenium+Electron,
  `products/jbrowse-desktop/test/screenshots.ts`); wants an hg38 demo with NCBI
  RefSeq + ClinVar. hg38 isn't loadable in the served-test-data headless run and
  there's no track-selector harness helper for desktop. Deferred.
