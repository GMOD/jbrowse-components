import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const ARABIDOPSIS_WGBS_CONFIG =
  'test_data/arabidopsis_methylation/config_emseq_bisulfite.json'

// One Arabidopsis WGBS pileup (Col-0 DRR029742, bwameth-aligned) over an
// NC_003070.9:4.398-4.412Mb window that pairs two methylation regimes side by
// side: the expressed ARM-repeat gene AT1G12930 (~4.398-4.406Mb) carries
// gene-body CpG methylation only, while the silenced element at its right
// (pseudogene AT1G12935 + unannotated repeat, ~4.406-4.410Mb) is methylated in
// all three plant contexts. The bisulfite color mode reads C-vs-T against the
// reference (no MM/ML tags): methylated C = red, unmethylated (C->T) = blue.
// Restricting the context to CpG / CHG / CHH re-scores the same reads, so the
// gene body stays red only under CpG while the TE stays red under all three —
// the tri-context signature that distinguishes plant heterochromatin from gene
// bodies. One spec per context; the compose stacks them CpG/CHG/CHH.
function arabidopsisBisulfite(
  name: string,
  colorBy: Record<string, unknown>,
): ScreenshotSpec {
  return {
    mode: 'url',
    name,
    url: lgvSession(ARABIDOPSIS_WGBS_CONFIG, {
      assembly: 'arabidopsis',
      loc: 'NC_003070.9:4,398,000-4,412,000',
      tracks: [
        {
          trackId: 'arabidopsis_wgbs',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            colorBy,
            // tall enough that the whole ~30x pileup fits without the display's
            // internal scroll clipping it mid-stack — a methylation-pattern
            // overview reads best with the full column of reads at normal row
            // height (taller marks are more legible; per-read detail is the
            // boundary-zoom figure's job)
            height: 320,
          },
        },
      ],
    }),
    readyText: 'Arabidopsis WGBS',
    // remote BAM over CDN, ~30x across 14kb: settles well under these caps
    readyTimeout: 90000,
    settleMs: 20000,
    // ruler + coverage + the full compact pileup, trimmed so the stacked
    // contexts aren't mostly whitespace (equal heights give a clean 3-panel stack)
    viewportHeight: 470,
  }
}

export const methylationSpecs: ScreenshotSpec[] = [
  arabidopsisBisulfite('methylation/arabidopsis_wgbs_cpg', {
    type: 'bisulfite',
  }),
  arabidopsisBisulfite('methylation/arabidopsis_wgbs_chg', {
    type: 'bisulfite',
    modifications: { cytosineContext: 'CHG' },
  }),
  arabidopsisBisulfite('methylation/arabidopsis_wgbs_chh', {
    type: 'bisulfite',
    modifications: { cytosineContext: 'CHH' },
  }),
  {
    mode: 'compose',
    name: 'methylation/arabidopsis_wgbs_contexts',
    parts: [
      'methylation/arabidopsis_wgbs_cpg',
      'methylation/arabidopsis_wgbs_chg',
      'methylation/arabidopsis_wgbs_chh',
    ],
  },
  // Zoomed to ~800bp straddling the gene->TE boundary (methylation jumps from
  // ~0% through 4,405,600 to ~90% at 4,406,000, MethylDackel-measured), colored
  // by ALL cytosines so every C on every read is a mark — individual reads are
  // now wide enough to read per-base: dense blue (unmethylated C->T) cytosines
  // on the gene-body side resolve into dense red (methylated) cytosines once the
  // reads cross into the silenced element, the boundary visible within single
  // reads that span it.
  {
    mode: 'url',
    name: 'methylation/arabidopsis_wgbs_boundary',
    url: lgvSession(ARABIDOPSIS_WGBS_CONFIG, {
      assembly: 'arabidopsis',
      loc: 'NC_003070.9:4,405,500-4,406,300',
      tracks: [
        {
          trackId: 'arabidopsis_wgbs',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            colorBy: {
              type: 'bisulfite',
              modifications: { cytosineContext: 'all' },
            },
          },
        },
      ],
    }),
    readyText: 'Arabidopsis WGBS',
    readyTimeout: 90000,
    settleMs: 20000,
    viewportHeight: 470,
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
          displaySnapshot: {
            // one-color modifications rendering (only methylated calls
            // colored) rather than the two-color methylation mode whose
            // blue "unmethylated" signal has no counterpart in the
            // bedmethyl track below
            colorBy: { type: 'modifications' },
          },
        },
        {
          trackId: 'COLO829_tumor.ht_modkit.bed_multi',
          displaySnapshot: {
            type: 'MultiLinearWiggleDisplay',
            defaultRendering: 'multirowxy',
            minScore: 0,
            maxScore: 100,
            height: 200,
          },
        },
      ],
    }),
    readyText: 'COLO829',
    // remote ONT CRAM: alignments finish ~15s, bedmethyl ~5s (both settle well
    // under these caps now that the empty-region loading hang is fixed)
    readyTimeout: 90000,
    settleMs: 30000,
  },

  // Same COLO829 chr20:21.5Mb CpG-island locus, but the reads are now GROUPED BY
  // HAPLOTYPE (HP tag, straight from the wf-somatic-variation haplotagged .ht
  // CRAM) while colored by modifications. Proves group-by-tag and per-read
  // base-modification coloring compose: the single pileup splits into one
  // 5mC-colored profile per haplotype (HP 1 / HP 2 / unphased), each with its
  // own coverage row, so allele-resolved methylation is readable with no
  // external tool. Compact rows keep all groups in frame. chr20:21.5Mb is used
  // (not a canonical imprinted DMR) because COLO829 is a cancer line with LOH at
  // H19/SNRPN/GNAS — those loci render a single unphased pileup, whereas 21.5Mb
  // retains heterozygosity and phases into distinct HP groups.
  {
    mode: 'url',
    name: 'methylation/colo829_haplotype_methylation',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr20:21,505,200-21,514,000',
      tracks: [
        'cpgisland_ucsc_hg38',
        {
          trackId: 'COLO829_tumor.ht',
          displaySnapshot: {
            type: 'LinearAlignmentsDisplay',
            colorBy: { type: 'modifications' },
            // the demo: stack the pileup into one section per HP tag value
            groupBy: { type: 'tag', tag: 'HP' },
            heightMode: 'fixed',
            featureHeight: 3,
            featureSpacing: 0,
          },
        },
      ],
    }),
    readyText: 'COLO829',
    readyTimeout: 90000,
    settleMs: 30000,
    // three stacked groups (HP1/HP2/unphased), each coverage + compact pileup;
    // trimmed to just the content so the stacked groups aren't mostly whitespace
    viewportHeight: 620,
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
              displaySnapshot: {
                type: 'LinearBasicDisplay',
                geneGlyphMode: 'longestCoding',
              },
            },
            'gencode_promoter_hg38_ucsc',
            {
              trackId: 'PAY22766-nanopore',
              displaySnapshot: {
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
            },
            {
              trackId: 'PBA15131-nanopore',
              displaySnapshot: {
                type: 'LinearAlignmentsDisplay',
                colorBy: {
                  type: 'modifications',
                  modifications: { shownModifications: ['a'] },
                },
                heightMode: 'fixed',
                featureHeight: 3,
                featureSpacing: 0,
              },
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
          displaySnapshot: {
            type: 'LinearBasicDisplay',
            geneGlyphMode: 'longestCoding',
          },
        },
        {
          trackId: 'HG002_snrpn_modkit_hp1',
          displaySnapshot: {
            type: 'MultiLinearWiggleDisplay',
            defaultRendering: 'multirowxy',
            minScore: 0,
            maxScore: 100,
            height: 120,
          },
        },
        {
          trackId: 'HG002_snrpn_modkit_hp2',
          displaySnapshot: {
            type: 'MultiLinearWiggleDisplay',
            defaultRendering: 'multirowxy',
            minScore: 0,
            maxScore: 100,
            height: 120,
          },
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
