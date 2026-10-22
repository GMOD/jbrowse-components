import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'
import { pageTrack } from './pageTrack.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// QuicK-mer2 1kb copy number for 104 PUR individuals. CCL3L1/CCL4L1 spans every
// copy number from 0 to 10 across them, the widest spread of the textbook
// multiallelic loci measured. Do not re-pick it by reputation.
const CCL3L1_WINDOW = 'chr17:36,080,000-36,270,000'

// The colored columns run chr17:36,193,000-36,457,000, so the block is about a
// third of this window. build_signal_zarr.ts covered chr17:35000000-37500000;
// past that the flanks render empty and read as two-copy sequence.
const CCL3L1_CONTEXT_WINDOW = 'chr17:35,975,000-36,675,000'

const SV_MAP_TRACK =
  'ALL.wgs.integrated_sv_map_v2_GRCh38.20130502.svs.genotypes.vcf'
const GENE_TRACK = 'ncbi_refseq_109_hg38_latest'

// Six PUR individuals from ~9 to 0 copies, high to low. Ten rows on a shared
// 0-10 axis leave the diploid baseline indistinguishable from a plateau.
const LADDER_TRACK = pageTrack('tutorials/population_cnv.md', 'pur_cnv_ladder')

// Pinned: a domainQuantile clip pins the top just above 2 and clamps the
// amplifications, and autoscaling changes what a color means per window. 0..4,
// not 0..6: the ramp divides both sides by the longer one, so a 0..6 domain
// caps a homozygous deletion at half saturation.
export const CN_HEATMAP_SETTINGS = {
  mark: 'span',
  origin: 2,
  scales: { y: { domainMin: 0, domainMax: 4 } },
  encoding: {
    color: {
      scale: { range: ['#2166ac', '#b2182b'] },
      legend: { title: 'Copy number' },
    },
  },
}

const CN_HEATMAP = {
  ...CN_HEATMAP_SETTINGS,
  trackId: 'pur_copynumber_1000g',
}

// `data-clustered` sits on the first-paint element, so this waits for the
// clustered frame even with `showTree: false`.
export const CLUSTERED_READY = `${displayPainted('wiggle-display')}[data-clustered="true"]`

// Loads jbrowse-plugin-zarr from its published beta bundle, so these figures
// need network for the plugin.
export const CNV_CONFIG = 'test_data/1000g_cnv/config.json'

// No whole-genome figure: swiftshader cannot rasterize 2504 rows x ~3100 bins
// before puppeteer's protocolTimeout, though a real browser renders it.
// `displayedRegionNames` on this config are unprefixed (`1`, `10`), matching
// the assembly's index; a chr-prefixed name launches a blank view.

export const cnv1000gSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'cnv1000g/ccl3l1_ladder',
    url: sessionSpec(DEMO_CONFIG, {
      sessionTracks: [LADDER_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: CCL3L1_WINDOW,
          tracks: [
            { trackId: GENE_TRACK, displayMode: 'compact', height: 80 },
            {
              trackId: 'pur_cnv_ladder',
              height: 500,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('wiggle-display'),
    readyTimeout: 120000,
    viewportHeight: 830,
  },

  {
    mode: 'url',
    name: 'cnv1000g/ugt2b17_biallelic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr4:68,480,000-68,660,000',
      tracks: [
        {
          trackId: GENE_TRACK,
          displayMode: 'compact',
          // Gene records only: `genes: 'only'` admits pseudogenes and leaves
          // the extra rows that overflow 80px.
          filter: ["jexl:feature.type=='gene'"],
          height: 80,
        },
        { trackId: SV_MAP_TRACK, height: 90 },
        {
          ...CN_HEATMAP,
          height: 420,
          runClustering: true,
          showTree: false,
        },
      ],
    }),
    readySelector: CLUSTERED_READY,
    readyTimeout: 300000,
    viewportHeight: 875,
  },

  {
    mode: 'url',
    name: 'cnv1000g/zarr_cohort',
    url: lgvSession(CNV_CONFIG, {
      assembly: 'hg38',
      loc: CCL3L1_CONTEXT_WINDOW,
      tracks: [
        {
          trackId: 'ncbi_refseq_hg38',
          displayMode: 'compact',
          height: 80,
        },
        {
          ...CN_HEATMAP_SETTINGS,
          trackId: 'cnv_1000g_zarr',
          type: 'LinearWiggleDisplay',
          // 2504 rows: each is sub-pixel, so the stack is the unit.
          height: 640,
          runClustering: true,
          showTree: false,
          // No row labels: at sub-pixel rows they fall back to population
          // swatches, interleaved at random by the clustering.
          showRowLabels: false,
        },
      ],
    }),
    readySelector: CLUSTERED_READY,
    readyTimeout: 300000,
    viewportHeight: 972,
    // Sub-pixel row-boundary jitter between runs.
    diffThreshold: 0.02,
    // Anchored to a locus in the right flank, the wider diploid strip the block
    // is read against; `dy` clears the score ramp in the same corner.
    // `textAlign: 'end'` would right-align every line inside the pill.
    annotations: [
      {
        type: 'text',
        anchor: {
          trackId: 'cnv_1000g_zarr',
          loc: 'chr17:36,470,000',
          fracY: 0,
          alignX: 'left',
          dx: 12,
          dy: 96,
        },
        textAlign: 'start',
        text: 'CCL3L1 / CCL4L1',
        fontSize: 19,
        maxWidth: 420,
      },
    ],
  },
]
