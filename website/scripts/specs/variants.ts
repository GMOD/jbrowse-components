import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  VOLVOX,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Tetraploid potato multi-sample VCF (jbrowse.org/genomes/potato) rendered as a
// genotype matrix — one column per variant, one row per sample. Loaded against
// the local build (bare ?config=, prefixed with localhost by the generator) so
// the current LinearMultiSampleVariantMatrixDisplay code runs, not the older
// released one the remote config was authored against. `maxMissingnessFilter`
// is the no-call ceiling config slot (1 = keep every variant).
//
// ONE SESSION, TWO LANES, not two screenshots stacked (review: "can consider
// making this a single screenshot with a copy of the track duplicated ... the
// height of each display can be e.g. 300 each, so very vertically compact").
// The compose this replaces paid for the contrast twice over: two app bars, two
// overviews, two search boxes and two rulers, ~420px of identical chrome, for
// two matrices that already sat on the same window at the same scale. Duplicated
// into one view they share all of that, the figure loses a third of its height,
// and the two lanes are on one ruler rather than on two that happen to agree.
//
// It takes two session tracks rather than the config's `tetraploid_vcf` twice
// because showTrackGeneric dedupes a view's tracks by trackId — a second
// `{ trackId: 'tetraploid_vcf' }` returns the lane already open instead of
// adding one. Same adapter, absolute URIs (a sessionTrack's relative uri would
// resolve against the page, not against the potato config), so the two lanes are
// the same bytes read with two ceilings. Their names carry the ceiling, which is
// also what retires the two text overlays the halves used to be labelled with.
const POTATO_BASE = 'https://jbrowse.org/genomes/potato/'
const POTATO_CONFIG = `${POTATO_BASE}config.json`
function potatoTrack(trackId: string, name: string) {
  return {
    type: 'VariantTrack',
    trackId,
    name,
    assemblyNames: ['Stuberosum_448_v4.03'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: {
        uri: `${POTATO_BASE}out.vcf.gz`,
        locationType: 'UriLocation',
      },
      index: {
        location: {
          uri: `${POTATO_BASE}out.vcf.gz.tbi`,
          locationType: 'UriLocation',
        },
        indexType: 'TBI',
      },
    },
  }
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
    // the sample clustering is a real RPC over the 1000G panel and does not
    // finish inside the 60s this used to allow — a sweep caught it at "Clustering
    // samples 81%". 120000 also crosses SLOW_READY_TIMEOUT_MS, which is honest:
    // a reader opening this figure's live link waits for the same computation.
    readyTimeout: 120000,
    settleMs: 2000,
    viewportHeight: 705,
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
    viewportHeight: 705,
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
      // without covering the word; tail sits just right of the pill (which
      // anchors to the same header, 230px out) on the header's own baseline, so
      // the arrow reads as a short horizontal connector and stays horizontal
      // wherever the panel puts the header
      {
        type: 'arrow',
        fromAnchor: { text: 'SAMPLES', dx: -122 },
        anchor: { text: 'SAMPLES' },
        dx: -60,
      },
    ],
  },

  // Multi-sample variant clustering, two-stage figure over the volvox
  // "1000genomes vcf" track (volvox_test_vcf, real 1000-genomes sample panel —
  // reviewer asked for this instead of the synthetic multi-sample SV track).
  // Top frame: the clustering dialog open (before). Bottom frame:
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
        // top frame: the clustering dialog open, before clustering
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Clustering', 'Cluster rows by genotype...']),
          { type: 'click', text: 'Cluster rows by genotype...' },
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

  // Before/after max-missingness filter over the tetraploid potato matrix, as
  // two lanes of one view: the ceiling at 1 keeps every variant, so the columns
  // with many no-call (missing) genotypes stay in the top lane, and at 0.1 every
  // variant whose no-call fraction exceeds 10% is gone from the bottom one. Same
  // bytes, same window, same scale — only the ceiling differs, so the columns
  // that vanish are exactly the high-missingness ones.
  {
    mode: 'url',
    name: 'variants/potato_missingness',
    url: sessionSpec(POTATO_CONFIG, {
      sessionTracks: [
        potatoTrack('potato_missingness_1', 'Max missingness 1.0 (default)'),
        potatoTrack('potato_missingness_01', 'Max missingness 0.1'),
      ],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'Stuberosum_448_v4.03',
          loc: 'ST4.03ch01:23,700,000-26,100,000',
          // Inline display props fold into the display snapshot
          // (normalizeTrackInit) and real config slots route onto the display
          // config, so `maxMissingnessFilter` sets the slot.
          tracks: [
            {
              trackId: 'potato_missingness_1',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 300,
              maxMissingnessFilter: 1,
            },
            {
              trackId: 'potato_missingness_01',
              type: 'LinearMultiSampleVariantMatrixDisplay',
              height: 300,
              maxMissingnessFilter: 0.1,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('variant-matrix-display'),
    readyTimeout: 120000,
    settleMs: 15000,
    // Close the TOP lane's genotype key. Both lanes draw the same five entries
    // over the same palette, and each copy hides the right ~13% of its own
    // matrix — in a figure whose whole argument is how the two textures differ
    // across the window, that is the comparison paying for the same legend
    // twice. The one on the well-genotyped lane stays, where four categories
    // are actually in play; the lane above it is a wall of one color that the
    // caption names in words.
    //
    // A click rather than a session prop because `showLegend` is volatile on
    // MultiSampleVariantBaseModel — legend visibility is deliberately not
    // session state, so a spec cannot set it. `actions` run after
    // `readySelector`, so the button exists, and the generator re-waits the
    // display phases and re-asserts render-settled afterwards.
    //
    // The first match IS the top lane: FloatingLegend portals into its own
    // TrackContainer's overlay node (TrackOverlayPortal), so the two legends sit
    // in track order rather than in mount order.
    actions: [{ type: 'click', selector: '[aria-label="Hide legend"]' }],
    // Narrower than the 1500 default: the matrix reads as a texture rather than
    // as per-column detail, so it loses nothing, and the figure is then not
    // twice the page width when both lanes are in it.
    viewportWidth: 1100,
    // 300 + 300 of matrix, their two track headers, and the ~185px of app bar,
    // overview, navigation row and ruler the two lanes now share once.
    viewportHeight: 830,
  },
]
