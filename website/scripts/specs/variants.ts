import {
  DEMO_CONFIG,
  VOLVOX,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Tetraploid potato multi-sample VCF (jbrowse.org/genomes/potato) rendered as a
// genotype matrix — one column per variant, one row per sample. Loaded against
// the local build (bare ?config=, prefixed with localhost by the generator) so
// the current LinearMultiSampleVariantMatrixDisplay code runs, not the older
// released one the remote config was authored against. `maxMissingnessFilter`
// is the no-call ceiling config slot (1 = keep every variant); the before/after
// pair below bakes two values into two otherwise byte-identical sessions so the
// compose figure shows exactly which columns the filter drops. Inline display
// props fold into the display snapshot (normalizeTrackInit) and real config
// slots route onto the display config, so `maxMissingnessFilter` sets the slot.
const POTATO_CONFIG = 'https://jbrowse.org/genomes/potato/config.json'
function potatoMissingnessMatrix(maxMissingnessFilter: number) {
  return sessionSpec(POTATO_CONFIG, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'Stuberosum_448_v4.03',
        loc: 'ST4.03ch01:23,700,000-26,100,000',
        tracks: [
          {
            trackId: 'tetraploid_vcf',
            type: 'LinearMultiSampleVariantMatrixDisplay',
            height: 420,
            maxMissingnessFilter,
          },
        ],
      },
    ],
  })
}

export const variantsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'volvox_variants',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:5000-10000',
      tracks: ['volvox_test_vcf'],
    }),
    viewportWidth: 1000,
    viewportHeight: 550,
    readyText: 'ctgA',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'variant_with_pileup',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:14439-14515',
      tracks: [
        {
          trackId: 'volvox_filtered_vcf',
          // the variant track is a single row of features, so shrink its
          // band so it doesn't dominate the figure over the pileup
          height: 60,
        },
        'volvox_cram_alignments',
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  // Multi-sample variant display colored by consequence impact, on REAL data:
  // a small local slice of 1000 Genomes phase 3 chr1 (2,504 real samples,
  // 1:155,000,000-155,050,000) run through real SnpEff 5.4c against the real
  // Ensembl GRCh37.75 database — unlike the volvox spec above, every ANN
  // annotation here is genuine SnpEff output on real genotypes, not
  // hand-crafted. See test_data/1000g_snpeff_chr1/README.md for provenance.
  // The window covers the DCST2/DCST1/ADAM15 locus, which has real
  // stop-gained/splice-site (HIGH) variants alongside missense/synonymous/
  // intronic ones.
  // Clustered so the 2,504 sample rows are reordered by genotype similarity with
  // a dendrogram in the left sidebar ("add clustering if it helps") —
  // co-inherited haplotype blocks group into contiguous same-color bands instead
  // of being scattered row-to-row. `runClustering: true` runs the real
  // clustering RPC declaratively (see getMultiSampleVariantClusterAutorun) —
  // no dialog-driving actions needed. `readySelector` waits on the dendrogram
  // itself (only rendered once the RPC result lands), so this stays correct
  // however long real clustering over the full callset takes (~24s locally),
  // rather than guessing a fixed timeout.
  {
    mode: 'url',
    name: 'variants/consequence_impact_1000g',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:155,015,000-155,035,000',
      tracks: [
        {
          trackId: '1000g_chr1_snpeff_consequence',
          type: 'LinearMultiSampleVariantDisplay',
          height: 500,
          runClustering: true,
        },
      ],
    }),
    readyText: 'chr1',
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    readyTimeout: 60000,
    settleMs: 2000,
    viewportHeight: 650,
  },

  // Multi-sample variant display colored by population: the 1000 Genomes phase 3
  // chr1 callset (2,504 samples) with a population samples-TSV, so the per-sample
  // rows group/color by the 26 population codes. The track config in
  // config_demo.json sets colorBy: 'population' on its LinearMultiSampleVariantDisplay.
  // Remote NCBI VCF — give it a long ready timeout and settle.
  {
    mode: 'url',
    name: 'variants/population_1000genomes',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:155,000,000-155,050,000',
      tracks: [
        {
          trackId:
            '1kGP_high_coverage_Illumina.chr1.filtered.SNV_INDEL_SV_phased_panel.vcf',
          type: 'LinearMultiSampleVariantDisplay',
          height: 500,
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    settleMs: 18000,
    viewportHeight: 650,
  },

  // Variant feature-details panel for an SNV, with the per-sample genotype table
  // in the SAMPLES section. The variant has no ID, so its only floating label is
  // the description ("C -> T"); clicking it opens the details panel.
  {
    mode: 'url',
    name: 'variant_panel',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:6257-6305',
      tracks: ['volvox_test_vcf'],
    }),
    readyText: 'ctgA',
    settleMs: 3000,
    // tall enough that the whole SAMPLES genotype-frequency table (low in the
    // variant-details panel) clears the viewport bottom — the callouts anchor
    // to its header, and the reviewer wanted its rows fully visible
    viewportWidth: 1150,
    viewportHeight: 1080,
    actions: [
      { type: 'click', text: 'C -> T' },
      { type: 'waitForText', text: 'HG00096' },
      { type: 'delay', ms: 1500 },
    ],
    // label the SAMPLES genotype table: pill sits to the left of the SAMPLES
    // header with a short horizontal arrow into it (the previous arrow was a
    // long diagonal floating across empty whitespace)
    annotations: [
      { type: 'box', anchor: { text: 'SAMPLES' } },
      {
        type: 'text',
        anchor: { text: 'SAMPLES' },
        dy: 0,
        dx: -230,
        maxWidth: 200,
        text: 'Per-sample genotypes',
      },
      // head nudged left of the SAMPLES header so the arrow points at it
      // without covering the word; tail sits just right of the pill on the same
      // baseline so the arrow reads as a short horizontal connector
      {
        type: 'arrow',
        from: { x: 680, y: 741 },
        anchor: { text: 'SAMPLES' },
        dx: -60,
      },
    ],
  },

  // Multi-sample variant clustering, two-stage figure over the volvox
  // "1000genomes vcf" track (volvox_test_vcf, real 1000-genomes sample panel —
  // reviewer asked for this instead of the synthetic multi-sample SV track).
  // Top frame: the "Cluster by genotype" dialog open (before). Bottom frame:
  // after "Run clustering", the samples are reordered by genotype similarity
  // with a dendrogram on the left. Combines the old cluster_dialog +
  // clustered_result screenshots into one multi-part figure.
  {
    mode: 'url',
    name: 'variants/cluster_dialog',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_test_vcf',
          type: 'LinearMultiSampleVariantMatrixDisplay',
          height: 400,
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 8000,
    viewportHeight: 700,
    stages: [
      {
        // top frame: the Cluster by genotype dialog open, before clustering
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          { type: 'waitForText', text: 'Cluster by genotype' },
          { type: 'click', text: 'Cluster by genotype' },
          { type: 'waitForText', text: 'Run clustering' },
        ],
      },
      {
        // bottom frame: run clustering, then show the reordered rows + dendrogram
        actions: [
          { type: 'click', text: 'Run clustering' },
          { type: 'waitForText', text: 'Run clustering', hidden: true },
          { type: 'delay', ms: 10000 },
        ],
      },
    ],
  },

  // Before/after max-missingness filter, over the tetraploid potato matrix.
  // "Before": the ceiling at 1 keeps every variant, so columns with many
  // no-call (missing) genotypes stay in the matrix.
  {
    mode: 'url',
    name: 'variants/potato_missingness_before',
    url: potatoMissingnessMatrix(1),
    readySelector: '[data-testid="variant-matrix-display-done"]',
    readyTimeout: 120000,
    settleMs: 15000,
    // equal heights for the two parts give a clean top/bottom stack in compose
    viewportHeight: 560,
    annotations: [
      {
        type: 'text',
        x: 300,
        y: 60,
        maxWidth: 520,
        fontSize: 15,
        text: 'Max missingness 1.0 (default): every variant kept, including high no-call columns',
      },
    ],
  },

  // "After": drop the ceiling to 0.1, so any variant whose no-call fraction
  // exceeds 10% is hidden. Same window and layout — only the filter differs, so
  // the columns that vanish are exactly the high-missingness ones.
  {
    mode: 'url',
    name: 'variants/potato_missingness_after',
    url: potatoMissingnessMatrix(0.1),
    readySelector: '[data-testid="variant-matrix-display-done"]',
    readyTimeout: 120000,
    settleMs: 15000,
    viewportHeight: 560,
    annotations: [
      {
        type: 'text',
        x: 300,
        y: 60,
        maxWidth: 520,
        fontSize: 15,
        text: 'Max missingness 0.1: variants with more than 10% no-call genotypes are dropped',
      },
    ],
  },

  // Stack the two panels (unfiltered over filtered) into one before/after figure
  // for the docs. Each part opens live on its own via its declarative session.
  {
    mode: 'compose',
    name: 'variants/potato_missingness',
    parts: [
      'variants/potato_missingness_before',
      'variants/potato_missingness_after',
    ],
  },
]
