import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const ARABIDOPSIS_WGBS_CONFIG =
  'test_data/arabidopsis_methylation/config_emseq_bisulfite.json'

// Arabidopsis WGBS (Col-0 DRR029742, bwameth-aligned) over
// NC_003070.9:4,398,000-4,412,000, a window that pairs two methylation regimes:
// the expressed ARM-repeat gene AT1G12930 (~4.398-4.406 Mb) carries gene-body
// CpG methylation only, while the silenced element to its right (pseudogene
// AT1G12935 + a repeat, ~4.406-4.410 Mb) is methylated in all three plant
// contexts. Three tracks stack the story: the RefSeq gene annotation for
// context, an aggregate MethylDackel track (per-position CpG/CHG/CHH fraction,
// one colored row each) that makes the tri-context contrast quantitative, and
// the per-read bisulfite pileup the tutorial demos — C-vs-T against the
// reference (no MM/ML tags): methylated C = red, unmethylated (C->T) = blue.
export const methylationSpecs: ScreenshotSpec[] = [
  // The three plant methylation contexts, kept as the single message of this
  // figure: gene annotation + the aggregate MethylDackel track with one labeled
  // row per context (CpG/CHG/CHH). CpG is high over both the gene body and the
  // silenced element; CHG/CHH are confined to the element. The per-read pileup is
  // deliberately NOT here — stacking a single-mode red/blue pileup under a
  // three-context aggregate read as "one mode vs three" and confused reviewers;
  // the raw reads get their own figure at the boundary below.
  {
    mode: 'url',
    name: 'methylation/arabidopsis_wgbs_contexts',
    url: lgvSession(ARABIDOPSIS_WGBS_CONFIG, {
      assembly: 'arabidopsis',
      loc: 'NC_003070.9:4,398,000-4,412,000',
      tracks: [
        { trackId: 'arabidopsis_genes' },
        // aggregate CpG/CHG/CHH fraction, one labeled row each (multirowxy, so
        // the three contexts don't overlay into a single apparent track)
        {
          trackId: 'arabidopsis_methyldackel',
          type: 'MultiLinearWiggleDisplay',
          defaultRendering: 'multirowxy',
          minScore: 0,
          maxScore: 100,
          height: 260,
        },
      ],
    }),
    readyText: 'MethylDackel',
    // remote gene GFF + three bigWigs: settles under these caps
    readyTimeout: 90000,
    settleMs: 12000,
    // genes + all three aggregate rows (CpG/CHG/CHH) + headers/ruler/overview
    viewportHeight: 640,
  },
  // Zoomed to ~3 kb straddling the gene->element boundary at 4,405,669 (the
  // AT1G12930 3' end, pinned by the gene track above), colored by ALL cytosines
  // so every C on every read is a mark and reads are wide enough to read
  // per-base: dense blue (unmethylated C->T) cytosines over the gene body
  // resolve into dense red (methylated) cytosines as reads cross into the
  // silenced element. This is the per-read counterpart to the aggregate contexts
  // figure above — reads only, one coloring mode, so nothing implies the
  // three-context aggregate here.
  {
    mode: 'url',
    name: 'methylation/arabidopsis_wgbs_boundary',
    url: lgvSession(ARABIDOPSIS_WGBS_CONFIG, {
      assembly: 'arabidopsis',
      loc: 'NC_003070.9:4,404,500-4,407,500',
      tracks: [
        { trackId: 'arabidopsis_genes' },
        {
          trackId: 'arabidopsis_wgbs',
          type: 'LinearAlignmentsDisplay',
          colorBy: {
            type: 'bisulfite',
            modifications: { cytosineContext: 'all' },
          },
        },
      ],
    }),
    readyText: 'Arabidopsis WGBS',
    readyTimeout: 90000,
    settleMs: 20000,
    viewportHeight: 560,
  },

  // CRAM modifications + bedmethyl together over a chr20:21.505-21.514Mb window
  // that captures a methylation *contrast* the reviewer asked for: the leftmost
  // CpG island (UCSC "CpG: 158", chr20:21,505,294-21,506,966) is hypomethylated
  // (~20%), while the adjacent CpG:26/33/214 island cluster
  // (chr20:21,507,762-21,513,742) is densely methylated (~90%, silenced) in the
  // COLO829 melanoma line — so the reads read out red/methylated across the
  // cluster and drop to blue over CpG:158. (The bedmethyl demo file only covers
  // chr20, so the earlier chr9 CDKN2A move had no bedmethyl data there — 0 rows,
  // which is why nothing lined up.) The COLO829 nanopore reads' per-base CpG
  // methylation calls (colorBy methylation) line up with the modkit bedmethyl
  // summary below. The bedmethyl uses the multi-row XY plot (reviewer ask): each
  // modification row is its own quantitative 0-100% xyplot, so the actual
  // methylation level per position is readable (unlike the density heatmap's
  // value-gradient, where exact levels can't be read off). This is distinct from
  // the single-row default twocolor xyplot whose negColor never shows for an
  // all-positive 0-100 percentage — multirowxy has no such issue.
  {
    mode: 'url',
    name: 'methylation/colo829_cram_and_bedmethyl',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // ~8.8kb window spanning the hypomethylated CpG:158 island (~20%) and the
      // densely-methylated CpG:26/33/214 cluster (~90%) so the methylated/
      // unmethylated transition is visible against the UCSC island boundaries
      loc: 'chr20:21,505,200-21,514,000',
      tracks: [
        // UCSC CpG-island annotation on top so the methylated/unmethylated
        // transition can be read against the island boundary (reviewer)
        'cpgisland_ucsc_hg38',
        {
          trackId: 'COLO829_tumor.ht',
          // one-color modifications rendering (only methylated calls
          // colored) rather than the two-color methylation mode whose
          // blue "unmethylated" signal has no counterpart in the
          // bedmethyl track below
          colorBy: { type: 'modifications' },
        },
        {
          trackId: 'COLO829_tumor.ht_modkit.bed_multi',
          type: 'MultiLinearWiggleDisplay',
          defaultRendering: 'multirowxy',
          minScore: 0,
          maxScore: 100,
          height: 200,
        },
      ],
    }),
    readyText: 'COLO829',
    // remote ONT CRAM: alignments finish ~15s, bedmethyl ~5s (both settle well
    // under these caps now that the empty-region loading hang is fixed)
    readyTimeout: 90000,
    settleMs: 30000,
  },

  // ONT HG002 fiber-seq (6mA) at the GAPDH promoter, modifications mode. The
  // enzyme-treated sample (PAY22766, top) carries 6mA (A+a) calls that the
  // native no-enzyme control (PBA15131, bottom) lacks at the same locus. Data:
  // https://epi2me.nanoporetech.com/chromatin-acc-hg002/
  {
    mode: 'url',
    name: 'methylation/chromatin_accessibility_6ma',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [HG38_GENCODE_PROMOTER_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          // wider than just the promoter (was 6,533,000-6,536,000) so the
          // gene body + flanking regions are visible too — the 6mA peak only
          // reads as significant in contrast with a flatter background either
          // side (reviewer: too tight, no context to judge significance)
          loc: 'chr12:6,528,000-6,543,000',
          tracks: [
            // NCBI RefSeq gene (not MANE, longest-coding transcript only) +
            // GENCODE promoter-window context so the 6mA accessibility signal
            // reads against the GAPDH promoter/TSS (reviewer: swap MANE for a
            // plain NCBI track, drop the CpG island — not relevant to
            // fiber-seq accessibility — add promoter windows instead). The
            // jbrowse.org/ucsc/hg38 hub gene track has unlabeled
            // pseudogene/silent_region entries upstream of GAPDH in this
            // window, so this uses the already-local, cleanly labeled RefSeq
            // track instead (same one gallery/fiberseq_gapdh uses at this
            // same locus).
            {
              trackId: 'ncbi_refseq_109_hg38_latest',
              type: 'LinearBasicDisplay',
              geneGlyphMode: 'longestCoding',
            },
            'gencode_promoter_hg38_ucsc',
            {
              trackId: 'PAY22766-nanopore',
              type: 'LinearAlignmentsDisplay',
              // this is a 6mA chromatin-accessibility assay; the basecaller
              // also emits 5mC/5hmC calls on the same reads, but those
              // aren't what this figure is about (reviewer: 6mA only). An
              // allow-list (shownModifications: 6mA code 'a') keeps it
              // 6mA-only regardless of what else the caller emitted.
              colorBy: {
                type: 'modifications',
                modifications: { shownModifications: ['a'] },
              },
              // compact pileup: displayMode isn't a real slot on this
              // display (that's the shared canvas base schema) — fixed
              // heightMode + a small featureHeight/featureSpacing is the
              // actual compact-row setting
              heightMode: 'fixed',
              featureHeight: 3,
              featureSpacing: 0,
              // reviewer: label the modification-type swatches (6mA calls)
              showLegend: true,
            },
            {
              trackId: 'PBA15131-nanopore',
              type: 'LinearAlignmentsDisplay',
              colorBy: {
                type: 'modifications',
                modifications: { shownModifications: ['a'] },
              },
              heightMode: 'fixed',
              featureHeight: 3,
              featureSpacing: 0,
            },
          ],
        },
      ],
    }),
    readyTimeout: 120000,
    // was 20000 — the prior capture committed while alignments were still
    // downloading (progress bars baked into the PNG), so give it more room
    settleMs: 45000,
    // taller so both alignment tracks' full pileup (compact mode still stacks
    // many rows for this depth) fit below the gene + promoter context tracks
    viewportHeight: 1000,
  },

  // Allele-specific methylation at the SNRPN / PWS-IC imprinting center
  // (chr15:24.95Mb) from HG002 ONT data. modkit emits a phased bedMethyl pileup
  // per haplotype (wf-human-variation .1/.2 outputs); the two tracks are those
  // per-haplotype pileups as 0-100% multi-row XY plots. At this germline
  // imprinting center one parental allele is ~89% 5mC and the other ~10% — the
  // textbook allele-specific-methylation split, readable directly off the two
  // stacked profiles with no external analysis. COLO829 can't show this (it's a
  // cancer line with LOH at every canonical DMR), so the demo switches data to
  // HG002 for this figure. Region files are the chr15:24.85-25.05Mb slice of
  // modkit's whole-genome phased bedMethyl, committed under test_data/hg002.
  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_allele_specific',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // SNRPN gene body + PWS-IC, wide enough to read the DMR against the CpG
      // island and the gene's first exons
      loc: 'chr15:24,952,000-24,958,000',
      tracks: [
        // UCSC CpG-island annotation: the imprinting center overlaps a CpG
        // island, so the methylated/unmethylated split lands on it
        'cpgisland_ucsc_hg38',
        // NCBI RefSeq gene track for SNRPN context
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
        },
        {
          trackId: 'HG002_snrpn_modkit_hp1',
          type: 'MultiLinearWiggleDisplay',
          defaultRendering: 'multirowxy',
          minScore: 0,
          maxScore: 100,
          height: 120,
        },
        {
          trackId: 'HG002_snrpn_modkit_hp2',
          type: 'MultiLinearWiggleDisplay',
          defaultRendering: 'multirowxy',
          minScore: 0,
          maxScore: 100,
          height: 120,
        },
      ],
    }),
    readyText: 'HG002',
    // small local region files, so both settle quickly
    readyTimeout: 60000,
    settleMs: 15000,
    // both single-row HP profiles (120px each) plus the CpG-island + gene
    // context on top, trimmed so the stacked haplotypes aren't mostly whitespace
    viewportHeight: 810,
  },
]
