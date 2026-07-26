---
name: handoff-1000g-cnv-gallery
description:
  Pending gallery copy edits, the planned 1000 Genomes QuicK-mer2 CNV tutorial,
  and the multi-sample signal format that blocks it. Read before picking up
  either.
---

# Handoff: gallery copy, the 1000G CNV tutorial, and multi-sample signal loading

Session of 2026-07-26. Three connected threads: a finished copy pass waiting to
be committed, a tutorial that is worth writing, and the format problem that caps
how good that tutorial can be.

**Threads 2 and 3 were built later the same day.** Read
[the status section](#status-2026-07-26-later-that-day) at the bottom first: the
tutorial is `website/docs/tutorials/population_cnv.md`, the format problem is
solved by `jbrowse-plugin-zarr` plus `scripts/build_signal_zarr.ts`, and the
open items are narrower than what the rest of this document describes. Thread 1
(gallery copy) is untouched and still accurate.

## Thread 1: gallery titles and captions

`website/src/lib/gallery.ts` only. Half landed, half pending.

**Committed** as `5ad6828ef6` (docs(gallery): name the dataset in card titles,
drop UI jargon, trim captions). Note it is missing the `Co-Authored-By` trailer.
That was deliberate: another agent committed into this worktree during the work,
so amending HEAD risked clobbering their commit. Do not amend it now either.

**Uncommitted in the working tree** (verified: `prettier` clean, and
`itemLiveHref` called over all 44 items without throwing):

- `Synteny blocks and gene anchors` to `Gene-level synteny`, with "anchors"
  replaced by what it means ("a set of matching gene pairs computed by MCScan")
  and "collinear" spelled out as "same strand"
- `GRCh38 vs T2T-CHM13 at TNNT3` to `hg38 vs CHM13 liftOver alignment`, TNNT3
  moved into the caption
- Chromosome minutiae dropped from six captions (chr19, chr3/chr13, chr20, chr4,
  chr8, left arm of chr2)
- The E. coli all-vs-all card moved from the synteny section to the pangenome
  section and retitled `E. coli all-vs-all alignment`
- Section `Pangenome graphs` retitled `Pangenomes`, because a PAF all-vs-all is
  not a graph. The `#pangenome` anchor is unchanged, so the `/gallery/#pangenome`
  links in `website/docs/**` and `HomePage.astro` still resolve.

### Copy rules the user stated, worth honoring in new cards and captions

These extend the caption rules already in `website/CLAUDE.md` (which cover
conciseness and no hand-measured claims). Folding them in there is a good
follow-up.

- Name the dataset in a title when the dataset is the draw (`hg19 vs hg38
  dotplot`, `E. coli all-vs-all`). A little biology in a title is fine.
- No biology lessons in captions. The rejected example was rs4988235 plus
  "-13910 C>T" plus "the variant behind lactase persistence" in one sentence.
- **No numerals.** `ChromHMM states for 127 epigenomes` and `Cohort copy number
  (1104 tumors)` were both rejected on this.
- Keep it dry. No "fan", "flanks", "lift off", "hangs off", "salt-and-pepper".
- Do not put our own UI vocabulary in a title: "mode", "split view", "display".
  `Tumor/normal split view` was called out specifically as unclear to readers.
- Do not over-specify coordinates. "Peach Pp05 against grape chr2" was too much.
- Prefer short titles. 32 characters was accepted, 46 is on the long side.

### Two card-level things left open

- **`gallery.astro:120-140` renders the guide link OR the live link, never
  both.** So for the 16 of 44 cards that set `guide:`, the only visible link is
  "Read the guide ↗" and "Open in JBrowse ↗" is reachable only by clicking the
  image into the lightbox. This is most of why the gallery reads as pointing at
  boring reference pages. Showing both is a few lines and needs no new docs.
- **Two duplicate-capability card pairs**, left alone pending a decision to cut:
  `Clustered copy-number heatmap` (1000 Genomes) against `TCGA-BRCA cohort copy
  number`, and `Variants called from a pangenome graph` against
  `Presence/absence by strain (PAV)` (same five-strain E. coli data, adjacent in
  one section).

## Thread 2: the 1000 Genomes QuicK-mer2 CNV tutorial

**Decided to write it.** The reason is not the calling pipeline, it is the
comparison: 1 kb depth-based copy number is far more precise than what the 1000
Genomes SV VCF can represent, and the VCF cannot express nested CNV at all. That
is a genuinely different story from `docs/tutorials/tcga_cohort_cnv.md`, which is
coarse segment calls oriented at cohort recurrence, so this is not a third
clustered-CNV page.

**Decided against a COLO829 tutorial.** `sv_visualization_cgiab` already covers
the cancer gold-standard story with a newer, simpler dataset. COLO829 is hg19,
more complicated, and its two coverage BigWigs
(`https://jbrowse.org/genomes/hg19/COLO829/colo_tumor.bw`, 1.7 GB, uploaded
2021) have no provenance recorded anywhere in the repo.

### Data facts established

- Track `pur_copynumber_1000g` in `test_data/config_demo.json`, hg38, is 104 PUR
  samples as `MultiWiggleAdapter` `bigWigs`, files named
  `<sample>.qm2.CN.1k.bw` under
  `https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR/`. `qm2` is
  QuicK-mer2 (Kidd lab), whose selling point is paralog sensitivity, which is
  exactly why it resolves structure the VCF flattens.
- **PUR was chosen to keep the track loadable, not for biology.** See thread 3.
- Other populations are hosted even though the config wires up only PUR:
  `YRI/NA19238`, `CEU/NA12878`, `CHB/NA18525` all return 206 on a range request.
- `HG00733` is a 404 in the PUR directory, so the PUR trio is only the two
  parents (`HG00731`, `HG00732`) here.
- `HG00731` and `HG00732` are also HPRC samples, so the same individuals appear
  in the depth rows and in the pangenome graph.
- The VCF contrast track needs no new data: `test_data/config_demo.json` already
  has the 1000 Genomes integrated SV map on hg38
  (`ALL.wgs.integrated_sv_map_v1_GRCh38`, `_v2_`, and
  `ALL.wgs.mergedSV.v8.20130502.svs.genotypes.GRCh38`).

### The combined depth-plus-bubbles view is buildable

`test_data/graphgenomeview/hprc.json` is already hg38 and already holds
`hprc_minigraph_bubbles` (`MinigraphBubbleAdapter`, nested bubbles on hg38
coordinates), `hprc_minigraph_segments` (`RgfaTabixAdapter`),
`hprc_minigraph_alleles`, and `hprc2_wave_grch38`. Adding the QuicK-mer2 track
there gives one config that can show depth profiles, nested bubbles, and a VCF at
one locus, plus a `GraphGenomeView` panel for the force-directed picture.

It has to be a **config** track, not a session track: 104 BigWig URLs will not
fit in a session-spec URL.

For the `GraphGenomeView` panel, copy the pattern at
`website/scripts/specs/graph.ts:487` (`pangenome/hprc_mhc_bandage`):
`loadedTrackId` plus `loadedRegion` plus `layoutMode: 'force'`. Budget for its
cost, that spec carries `readyTimeout: 120000`, `settleMs: 8000`, and
`diffThreshold: 0.1` for FMMM layout jitter.

### Open questions

- **Locus.** The existing figure sits at hg38 `chr3:162,275,163-163,360,944`
  (`gallery/copynumber_clustered` in `website/scripts/specs/gallery.ts`), chosen
  for how the clustering looks, not for nested structure. Pick the tutorial locus
  by measurement instead: read the BigWigs and the bubble track over candidate
  multi-allelic regions (AMY1 near hg38 chr1:103.6 Mb is the textbook one) and
  choose where depth shows several CN levels, the graph is nested, and the SV map
  has one coarse record. Do not pick it by reputation.
- **One page or two figures.** Depth plus bubbles plus VCF in one LGV is
  straightforward. The `GraphGenomeView` panel makes the nesting point much
  better but is the expensive, jitter-prone part.
- **A QuicK-mer2 how-to section.** The user wants it for reader confidence, not
  as a requirement. Honest scope is one sample against the published k-mer index,
  since building the index is a heavyweight prerequisite. Verify every command
  against the upstream repo and state the paralog-sensitivity claim the way the
  paper states it. Modern alternatives worth offering for a reader's own data are
  the long-read depth callers that emit per-base depth BigWigs (HiFiCNV or
  sawfish for PacBio, Spectre for ONT), because their output drops into the same
  multi-quantitative track and the same clustering. Verify their commands too
  rather than writing from memory.

## Thread 3: multi-sample quantitative signal loading (the real blocker)

The tutorial wants every 1000 Genomes sample. Loading ~1000 BigWigs is too slow,
which is why the shipped track is a 104-sample PUR subset.

### Measured, not assumed

- One PUR BigWig is **387,459 bytes** for the whole genome at 1 kb bins. All 104
  genome-wide is about 40 MB. **Payload is not the problem.**
- A range request to jbrowse.org from a dev machine is about **210 ms**: three
  sequential small range reads against one file took 0.64 s.
- A BigWig needs its header, chrom B-tree, and R-tree index before it knows where
  a region's data lives, so that is **3 to 4 sequential round trips per file**
  before the first value.
- Fetching only the first 64 KB of all 104 files took **4.2 s at concurrency 6,
  9.3 s at 20, 4.2 s at 60** (noisy, but the floor is latency-bound).
- `MultiWiggleAdapter` also runs a second full pass over every file for stats
  (`getRegionQuantitativeStats` and `getMultiRegionQuantitativeStats`, both
  `Promise.all` over all subadapters), so a screen costs two storms.
- Corroborating evidence in the existing spec: `gallery/copynumber_clustered`
  needs `readyTimeout: 90000` and `settleMs: 15000` for 104 files.

**Conclusion: the format requirement is to minimize requests, not bytes.**

### Options, ranked by how much we would have to build

- **Zarr v3, bin-major chunks** (samples x bins, chunked so one screen-width
  query returns every sample in one or two requests, with per-sample stats in the
  metadata so the stats pass disappears). Best browser story: zarrita.js reads
  chunks over plain HTTP range requests against static hosting, no tile server.
  HiGlass's multivec format is the direct precedent for this exact data type, and
  `agent-docs/OTHER_IDEAS.md` already floats Zarr for large-cohort variants, so
  it would not be a one-off. Work: a converter script plus one adapter.
- **D4 multi-track.** Genomics-native, purpose-built for depth, mosdepth writes
  it, one file holds many tracks with random access. No JS reader exists, so we
  would write one. More work than Zarr for the same win.
- **HDF5 / multivec proper.** The HiGlass precedent, but h5wasm plus HTTP chunk
  access is heavier than Zarr for no added benefit.
- **Stopgap, no new format.** At 387 KB per file, fetching whole files with a
  concurrency cap beats index-guided range reads. Maybe 2 to 3x, still N
  requests, does not reach 2500 samples.

### Why this is cheaper than it sounds

`plugins/wiggle/src/MultiWiggleAdapter/MultiWiggleAdapter.ts` exposes
`getSources` plus `getMultiSourceFeatureArraysMulti`, which returns per-source
arrays aligned to the requested regions. That is the shape a matrix query
naturally produces, and per
`architecture-decision-records/adr-021-getfeaturearrays-stays-duck-typed.md` the
interface is duck-typed, so a matrix adapter slots in without touching
renderers. Row clustering also needs the whole region matrix anyway, so one fetch
serves both the render and "Cluster rows by score".

### Proposed next step

Convert the existing 104 PUR BigWigs to one chunked array, put a minimal adapter
behind it, and compare time-to-first-render against the current path at the same
locus. If it lands where the arithmetic says, extending to all 2504 samples is a
converter run rather than a re-architecture, and the tutorial gets every sample
instead of one population subsetted for load time.

## Status, 2026-07-26 later that day

Threads 2 and 3 are built. The arithmetic held, by a wider margin than expected.

### What exists now

- **`website/docs/tutorials/population_cnv.md`** and five figures under
  `website/scripts/specs/cnv1000g.ts`. Locus picked by measurement as the
  handoff asked: over the 104 PUR samples the CCL3L1/CCL4L1 window
  (chr17:36,080,000-36,270,000) carries every integer copy number from 0 to 10,
  the widest spread of a dozen textbook multiallelic loci probed. AMY1 only
  reaches 0-4 at 1 kb resolution, LPA 2-8, HP 2-7. Do not re-pick it by
  reputation.
- **`jbrowse-plugin-zarr`** (`~/src/jb2plugins/jbrowse-plugin-zarr`, external
  plugin loaded by URL like protein3d) with `MultiWiggleZarrAdapter`: reads a
  samples-by-bins Zarr v3 store, duck-typed into the multi-wiggle display so
  nothing in the monorepo changed to support it. 52 KB built, six unit tests.
- **`scripts/build_signal_zarr.ts`** plus **`scripts/build_1000g_cnv_zarr.sh`**,
  which derives all 2504 samples from the Kidd lab trackDb.
- **`test_data/1000g_cnv/`**: the built store (all 2504 samples over
  chr17:35-37.5Mb and chr4:68-69Mb, **1.3 MB**) and a config using it.

### Measured, same window, same values

| path                       | requests | note                                  |
| -------------------------- | -------- | ------------------------------------- |
| 104 BigWigs                | **625**  | six per file, sequential within a file |
| 2504 samples, Zarr         | **3**    | group metadata, array metadata, one chunk |

The Zarr number does not grow with the cohort, because the sample axis is inside
the chunk. Building the 2504-sample store from the hosted BigWigs takes ~30 s.

### Open

- **The plugin is not published**, so `test_data/1000g_cnv/config.json` points at
  a `jbrowse.org/plugins/jbrowse-plugin-zarr/latest/` URL that 404s today, and
  the two Zarr figures cannot be regenerated until it exists. They were rendered
  against a locally served build of the same bundle. Publish the plugin, then
  re-run `--filter cnv1000g --force` to confirm.
- The store covers two windows rather than whole genomes, to stay a repo
  fixture. `--whole-genome` works but holds the full base matrix in memory.
- Thread 1 (gallery copy) is still exactly as described above, uncommitted.
