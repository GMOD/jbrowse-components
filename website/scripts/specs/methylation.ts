import {
  DEMO_CONFIG,
  HG38_GENCODE_PROMOTER_TRACK,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

const ARABIDOPSIS_WGBS_CONFIG =
  'test_data/arabidopsis_methylation/config_emseq_bisulfite.json'

// three copies of the one WGBS CRAM, each colored by a different cytosine
// context, so the per-read pileup demonstrates the three MethylDackel contexts
// directly (not just the aggregate). Distinct trackIds share one adapter.
const WGBS_CRAM_ADAPTER = {
  type: 'CramAdapter',
  uri: 'https://jbrowse.org/demos/bisulfite/arabidopsis_wgbs_bisulfite.cram',
}
function wgbsContextTrack(context: 'CG' | 'CHG' | 'CHH') {
  const label = context === 'CG' ? 'CpG' : context
  return {
    track: {
      type: 'AlignmentsTrack',
      trackId: `arabidopsis_wgbs_${context.toLowerCase()}`,
      name: `Per-read WGBS — ${label} context`,
      assemblyNames: ['arabidopsis'],
      adapter: WGBS_CRAM_ADAPTER,
    },
    display: {
      trackId: `arabidopsis_wgbs_${context.toLowerCase()}`,
      type: 'LinearAlignmentsDisplay',
      colorBy: {
        type: 'bisulfite',
        // methylated-only is the default, so the tri-context contrast reads as
        // presence/absence of red rather than a red/blue mix per read
        modifications: { cytosineContext: context },
      },
      // compact reads, coverage hidden: three stacked pileups stay legible and
      // the row's message is the read colors, not a per-copy histogram
      showCoverage: false,
      heightMode: 'fixed',
      featureHeight: 3,
      featureSpacing: 0,
      height: 90,
    },
  }
}
const WGBS_CONTEXT_COPIES = (['CG', 'CHG', 'CHH'] as const).map(
  wgbsContextTrack,
)

// Arabidopsis WGBS (Col-0 DRR029742, bwameth-aligned) over
// NC_003070.9:4,398,000-4,412,000, a window that pairs two methylation regimes:
// the expressed ARM-repeat gene AT1G12930 (~4.398-4.406 Mb) carries gene-body
// CpG methylation only, while the silenced element to its right (pseudogene
// AT1G12935 + a repeat, ~4.406-4.410 Mb) is methylated in all three plant
// contexts. The contexts figure below shows this at two levels: the aggregate
// MethylDackel fractions (one row per context) AND the same per-read pileup
// colored three ways (one copy per context), so the tri-context contrast reads
// both quantitatively and per-molecule. The per-read copies use one-color mode:
// methylated C = red, unmethylated sites left blank.
export const methylationSpecs: ScreenshotSpec[] = [
  // The three plant methylation contexts, shown at both levels so the "3 modes"
  // is unmistakable and consistent: the aggregate MethylDackel track (one 0-100%
  // row per context) over THREE copies of the same per-read WGBS pileup, each
  // colored by one context (CpG/CHG/CHH). Each per-read copy lines up 1:1 with
  // its aggregate row. CpG is methylated over both the gene body AND the element
  // (red left + right); CHG/CHH are methylated only over the silenced element
  // (red confined to the right).
  {
    mode: 'url',
    name: 'methylation/arabidopsis_wgbs_contexts',
    url: sessionSpec(ARABIDOPSIS_WGBS_CONFIG, {
      sessionTracks: WGBS_CONTEXT_COPIES.map(c => c.track),
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'arabidopsis',
          loc: 'NC_003070.9:4,398,000-4,412,000',
          tracks: [
            { trackId: 'arabidopsis_genes' },
            // aggregate CpG/CHG/CHH fraction, one labeled row each (multirowxy)
            {
              trackId: 'arabidopsis_methyldackel',
              type: 'MultiLinearWiggleDisplay',
              defaultRendering: 'multirowxy',
              minScore: 0,
              maxScore: 100,
              height: 170,
            },
            ...WGBS_CONTEXT_COPIES.map(c => c.display),
          ],
        },
      ],
    }),
    readyText: 'MethylDackel',
    // remote CRAM (x3 copies, one adapter) + gene GFF + three bigWigs
    readyTimeout: 90000,
    settleMs: 20000,
    // genes + aggregate(3 rows) + 3 compact pileups + headers/ruler/overview
    viewportHeight: 900,
    // larger red pill labels naming each context row (reviewer). The aggregate
    // multiwiggle stacks CpG/CHG/CHH in one 170px container (row centers ~28/85/
    // 142px, so each label is nudged ±57px off the container center), and the
    // three per-read pileups each get the matching label anchored to their own
    // track row. dx pulls the pill toward the left edge of the data.
    annotations: [
      ...(['CpG', 'CHG', 'CHH'] as const).map((text, i) => ({
        type: 'text' as const,
        anchor: {
          selector:
            '[data-testid^="trackRenderingContainer-"][data-testid$="-arabidopsis_methyldackel"]',
        },
        dx: -600,
        dy: (i - 1) * 57,
        fontSize: 22,
        text,
      })),
      ...(
        [
          ['cg', 'CpG'],
          ['chg', 'CHG'],
          ['chh', 'CHH'],
        ] as const
      ).map(([ctx, text]) => ({
        type: 'text' as const,
        anchor: {
          selector: `[data-testid^="trackRenderingContainer-"][data-testid$="-arabidopsis_wgbs_${ctx}"]`,
        },
        dx: -600,
        fontSize: 22,
        text,
      })),
    ],
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
      // island and the gene's first exons (reviewer: zoom out a little — was
      // 24,952,000-24,958,000, a 6kb window, now 8kb around the same center)
      loc: 'chr15:24,951,000-24,959,000',
      tracks: [
        // UCSC CpG-island annotation: the imprinting center overlaps a CpG
        // island, so the methylated/unmethylated split lands on it. Kept short —
        // it's a single annotation lane, so it needs no vertical room
        {
          trackId: 'cpgisland_ucsc_hg38',
          type: 'LinearBasicDisplay',
          height: 40,
        },
        // NCBI RefSeq gene track for SNRPN context, given extra height so the
        // gene model reads clearly above the methylation profiles
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
          height: 180,
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
    // both single-row HP profiles (120px each) plus the short CpG-island lane
    // and the taller gene track on top, trimmed so the stacked haplotypes aren't
    // mostly whitespace
    viewportHeight: 830,
  },

  // Per-read view behind the aggregate SNRPN profiles: the same HG002 ONT reads
  // modkit summarized, plotted individually. groupBy HP splits the pileup into
  // the two phased haplotypes and the fill-unmarked modifications view (formerly
  // the standalone "methylation" scheme) paints each CpG call (red = 5mC,
  // blue = unmethylated), so the allele-specific split is visible
  // read-by-read — one haplotype's reads are methylated across the CpG island
  // while the other's are not, the read-level source of the ~87%/~5% aggregate.
  // Reads are the chr15 SNRPN slice of the GIAB HG002 ONT alignment, haplotagged
  // against the phased SNP calls, hosted next to the bedMethyl slices.
  {
    mode: 'url',
    name: 'methylation/hg002_snrpn_reads',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      // wider window around the SNRPN promoter / PWS-IC so the DMR sits in
      // gene-body/flanking context; the per-haplotype red-vs-blue methylation
      // contrast is clear, and the CpG-island track above marks the DMR
      loc: 'chr15:24,948,000-24,962,000',
      tracks: [
        'cpgisland_ucsc_hg38',
        {
          trackId: 'ncbi_refseq_109_hg38_latest',
          type: 'LinearBasicDisplay',
          geneGlyphMode: 'longestCoding',
          displayMode: 'compact',
        },
        {
          trackId: 'HG002_snrpn_5mC_reads',
          type: 'LinearAlignmentsDisplay',
          height: 560,
          forceLoad: true,
          groupBy: { type: 'tag', tag: 'HP' },
          colorBy: {
            type: 'modifications',
            modifications: { fillUnmarked: true },
          },
        },
      ],
    }),
    readySelector: '[data-testid="pileup-display-done"]',
    readyTimeout: 90000,
    settleMs: 15000,
    viewportHeight: 880,
    // label the two haplotype bands the groupBy HP split produces (reviewer):
    // HP:1 reads are methylated (red) across the DMR, HP:2 unmethylated (blue)
    annotations: [
      {
        type: 'text',
        x: 170,
        y: 505,
        fontSize: 20,
        text: 'reads tagged HP:1',
      },
      {
        type: 'text',
        x: 170,
        y: 700,
        fontSize: 20,
        text: 'reads tagged HP:2',
      },
    ],
  },

  // Combine the two SNRPN allele-specific views into one figure (reviewer): the
  // per-haplotype aggregate 5mC profiles on top, the per-read pileup that
  // produces them below. Same assembly (hg38) and locus (chr15 PWS-IC, ~24.955
  // Mb), so the aggregate/per-read pair reads top-to-bottom as summary → source.
  // Each part stays its own openable figure; compose only stacks the committed
  // PNGs. (The two windows differ in zoom — 8kb vs 14kb — so their x-scales are
  // not pixel-aligned across the seam.)
  {
    mode: 'compose',
    name: 'methylation/hg002_snrpn_combined',
    parts: [
      'methylation/hg002_snrpn_allele_specific',
      'methylation/hg002_snrpn_reads',
    ],
  },
]
