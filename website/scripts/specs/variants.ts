import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  VOLVOX,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The tetraploid potato VCF as two session tracks over the same files, since
// showTrackGeneric dedupes a view's tracks by trackId. The URIs are absolute: a
// session track's relative uri resolves against the page.
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
          genotypes: { show: false },
          height: 60,
        },
        'volvox_cram_alignments',
      ],
    }),
    readyText: 'ctgA',
  },

  // 1000 Genomes chr1 run through SnpEff
  // (test_data/1000g_snpeff_chr1/README.md), clustered by `runClustering`. The
  // dendrogram renders only once the RPC lands.
  {
    mode: 'url',
    name: 'variants/consequence_impact_1000g',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg19',
      loc: '1:155,015,000-155,035,000',
      tracks: [
        {
          trackId: '1000g_chr1_snpeff_consequence',
          height: 500,
          runClustering: true,
        },
      ],
    }),
    readyText: 'chr1',
    readySelector: '[data-testid="tree_sidebar_dendrogram"]',
    // Clustering the 1000G panel ran past 60s in a sweep.
    readyTimeout: 120000,
    viewportHeight: 705,
  },

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
          height: 500,
        },
      ],
    }),
    readyText: 'chr1',
    readyTimeout: 90000,
    viewportHeight: 705,
  },

  // The variant's record, in the records band above the rows: a hom-ref cell
  // opens nothing.
  {
    mode: 'url',
    name: 'variant_panel',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:6257-6305',
      tracks: ['volvox_test_vcf'],
    }),
    readyText: 'ctgA',
    // Tall enough to show the whole SAMPLES table the callouts anchor to.
    viewportWidth: 1150,
    viewportHeight: 1080,
    actions: [
      {
        type: 'click',
        anchor: {
          trackId: 'volvox_test_vcf',
          loc: 'ctgA:6,285',
          band: '[data-testid="records_band"]',
          fracY: 0.2,
        },
      },
      { type: 'waitForText', text: 'HG00096' },
    ],
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
      // The tail is measured off the same header as the pill, so the arrow
      // stays horizontal wherever the panel puts the header.
      {
        type: 'arrow',
        fromAnchor: { text: 'SAMPLES', dx: -122 },
        anchor: { text: 'SAMPLES' },
        dx: -60,
      },
    ],
  },

  {
    mode: 'url',
    name: 'variants/cluster_dialog',
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_test_vcf',
          variantLayout: 'columns',
          height: 400,
        },
      ],
    }),
    readyText: 'ctgA',
    viewportHeight: 700,
    stages: [
      {
        actions: [
          { type: 'click', selector: '[data-testid="track_menu_icon"]' },
          ...menuCascade(['Clustering', 'Cluster rows by genotype...']),
          { type: 'click', text: 'Cluster rows by genotype...' },
          { type: 'waitForText', text: 'Run clustering' },
        ],
      },
      {
        actions: [
          { type: 'click', text: 'Run clustering' },
          { type: 'waitForText', text: 'Run clustering', hidden: true },
        ],
      },
    ],
  },

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
          tracks: [
            {
              trackId: 'potato_missingness_1',
              variantLayout: 'columns',
              height: 300,
            },
            {
              trackId: 'potato_missingness_01',
              variantLayout: 'columns',
              height: 300,
              filter: [{ field: 'missingness', lte: 0.1 }],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('variant-matrix-display'),
    readyTimeout: 120000,
    // Hides the top lane's legend, which covers ~13% of its matrix.
    // `showLegend` is volatile on this display, so only a click can set it. The
    // first match is the top lane: FloatingLegend portals into its own
    // TrackContainer.
    actions: [{ type: 'click', selector: '[aria-label="Hide legend"]' }],
    // Narrower than the 1500 default; the matrix reads as a texture.
    viewportWidth: 1100,
    viewportHeight: 856,
  },
]
