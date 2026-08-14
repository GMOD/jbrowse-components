import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  DEMO_CONFIG,
  lgvSession,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// QuicK-mer2 1kb copy number for the 104 PUR individuals of the 1000 Genomes
// panel (Kidd lab), already wired into config_demo as `pur_copynumber_1000g`.
// The locus was picked by measurement, not reputation: over 104 samples the
// CCL3L1/CCL4L1 window carries every integer copy-number level from 0 to 10,
// the widest spread of the dozen textbook multiallelic loci probed (AMY1 0-4,
// LPA 2-8, HP 2-7, UGT2B17 0-2). Do not re-pick it by reputation.
const CCL3L1_WINDOW = 'chr17:36,080,000-36,270,000'

// The same locus with room around it, for the whole-cohort figure (review:
// "consider zooming out farther to show bigger window, that this is an abnormal
// thing essentially"). At the ladder's width every column of the 2504-row
// heatmap carries a gain or a loss, so the frame has nothing in it that is
// ordinary and the block reads as the background rather than as the finding.
// Eight times wider puts flat diploid white on both sides of it.
//
// Bounded by the store rather than by taste: build_signal_zarr.ts was run with
// `--region chr17:35000000-37500000`, so a window past that renders empty
// flanks that look like ordinary two-copy sequence and are actually no data.
const CCL3L1_CONTEXT_WINDOW = 'chr17:35,520,000-37,020,000'

// The 1000 Genomes phase 3 integrated SV map, lifted to GRCh38, already in
// config_demo. It is the comparison the tutorial is built on, not a second data
// source: over this window it holds one multiallelic CNV record with three
// symbolic alleles, and nothing at all where the depth ladder is.
const SV_MAP_TRACK =
  'ALL.wgs.integrated_sv_map_v2_GRCh38.20130502.svs.genotypes.vcf'
const GENE_TRACK = 'ncbi_refseq_109_hg38_latest'

const KIDD_LAB_BASE =
  'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR'

// Six PUR individuals spanning the CCL3L1 ladder, measured over
// chr17:36,193,000-36,198,000 at roughly 9, 7, 5, 4, 2 and 0 copies. Listed high
// to low so the stacked plots read as a descending staircase. Six and not the
// ten the ladder has room for: on a shared 0-10 axis, ten rows leave each plot
// too short for the diploid baseline to be visibly below the plateau, which is
// the whole thing this figure has to show.
const LADDER_SAMPLES = [
  'HG01177',
  'HG01083',
  'HG01070',
  'HG01395',
  'HG00731',
  'HG00553',
]

const LADDER_TRACK = {
  type: 'MultiQuantitativeTrack',
  trackId: 'pur_cnv_ladder',
  name: 'PUR copy number, six individuals',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'MultiWiggleAdapter',
    subadapters: LADDER_SAMPLES.map(name => ({
      type: 'BigWigAdapter',
      name,
      bigWigLocation: {
        uri: `${KIDD_LAB_BASE}/${name}.qm2.CN.1k.bw`,
        locationType: 'UriLocation',
      },
    })),
  },
}

// Copy number is an absolute quantity, so its scale is pinned rather than
// autoscaled: nearly every bin of nearly every sample sits at the diploid
// baseline, so localpercentile pins the top just above 2 and clamps the
// amplifications the figure is about, and `local` re-scales on every navigation
// so a block means a different number in each window. Pinned, the color means a
// copy number: white is two copies, red a gain, blue a loss, the same in every
// window.
//
// 0..4 and not 0..6, which looks like it would show more: the density ramp
// divides both sides by the LONGER one, so with the pivot at 2 a 0..6 domain
// caps a homozygous deletion at half saturation, exactly the intensity of a
// single extra copy pair. Symmetric around the pivot is the only way a
// diverging scale reads as diverging. The cost is that gains past 4 clamp,
// which the legend's own bar shows.
const CN_HEATMAP_SETTINGS = {
  type: 'MultiLinearWiggleDisplay',
  defaultRendering: 'multirowdensity',
  bicolorPivot: 2,
  minScore: 0,
  maxScore: 4,
  posColor: '#b2182b',
  negColor: '#2166ac',
}

const CN_HEATMAP = {
  ...CN_HEATMAP_SETTINGS,
  trackId: 'pur_copynumber_1000g',
}

// A clustered multi-wiggle display publishes `data-clustered` on the same
// element as its first-paint testid, so this waits on the post-clustering frame
// even though `showTree: false` removes the dendrogram (which is the only other
// DOM evidence clustering ran).
const CLUSTERED_READY = `${displayPainted('multi-wiggle-display')}[data-clustered="true"]`

// The tutorial's own config: hg38, the 2504-sample Zarr store in test_data,
// RefSeq genes and the SV map. It loads jbrowse-plugin-zarr from its published
// beta bundle at jbrowse.org/demos/zarr/, the same arrangement as
// graphgenomeviewer, so the figures below need network for the plugin itself.
const CNV_CONFIG = 'test_data/1000g_cnv/config.json'

// Kept although nothing uses it now (the whole-chromosome figures went with
// cnv1000g/genome_summary_bins), because both halves cost a session to learn:
//
// A whole-genome view of this store renders fine in a real browser, on WebGL
// and on WebGPU, and only this harness cannot capture it -- the capture runs
// headless on swiftshader, and 2504 rows x ~3100 bins is ~7.8M quads into a
// 1400x420 box, which a software rasterizer will not finish (34 minutes, then
// puppeteer's protocolTimeout). Check `--use-angle=gl` (cancel-bench.ts does)
// before believing any "too much data to draw" story told by a capture.
//
// And `displayedRegionNames` here is UNPREFIXED, which this config's filename
// argues against: its assembly is hg38.prefix.fa.gz, whose index reads `1`,
// `10`, `11`. The store's own refNames ARE chr-prefixed and refNameAliases
// reconcile them per query, but displayedRegionNames resolves against the
// assembly's regions before any adapter is asked. Spelled wrong, the view
// launches with no regions and the capture is blank rather than an error
// naming the contig.

export const cnv1000gSpecs: ScreenshotSpec[] = [
  // The window as individual profiles. The plateaus are flat and quantized, so
  // a reader can count copies off the y axis rather than trust a color.
  //
  // This used to be the companion to cnv1000g/ccl3l1_depth, a 104-sample PUR
  // heatmap of the same window that opened the page. That one is deleted:
  // cnv1000g/zarr_cohort draws the same locus the same way for all 2504
  // individuals, which is what the Zarr store bought, and the PUR cut only
  // existed because 2504 bigwigs were too slow to plot.
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
              type: 'MultiLinearWiggleDisplay',
              // multirowLINE, not multirowxy (reviewer: "not interesting
              // screenshot really, consider delete"). The claim is that the
              // plateaus are flat, quantized and countable off the axis, and a
              // filled area over a flat integer plateau paints each row as a
              // solid bar whose only readable feature is its top edge. Six of
              // those stacked is six blue slabs, which is what made a real
              // result look like nothing. As step traces you read the level
              // and where it steps. Same finding as cookbook_multiwig, which
              // was rebuilt for it.
              defaultRendering: 'multirowline',
              height: 500,
              minScore: 0,
              maxScore: 10,
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('multi-wiggle-display'),
    readyTimeout: 120000,
    viewportHeight: 830,
    settleMs: 8000,
  },

  // The control. UGT2B17 is a biallelic deletion, and there the two
  // representations agree: depth is flat at 0, 1 or 2 copies with the same
  // breakpoints in every carrier, and the SV map calls it as a <CN0> deletion
  // at 47% allele frequency. A tutorial that only showed the disagreement would
  // read as an argument against callsets.
  {
    mode: 'url',
    name: 'cnv1000g/ugt2b17_biallelic',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: 'chr4:68,480,000-68,660,000',
      tracks: [
        { trackId: GENE_TRACK, displayMode: 'compact', height: 80 },
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
    viewportHeight: 865,
    settleMs: 15000,
  },

  // The whole panel, not one population: all 2504 individuals over the same
  // window, from one Zarr store instead of 2504 BigWigs. The picture is the
  // argument for the format — the 104-sample figure above already takes minutes
  // of latency-bound fetching, and 2504 files would be 24 times that, while the
  // store answers the same view in three requests.
  {
    mode: 'url',
    name: 'cnv1000g/zarr_cohort',
    url: lgvSession(CNV_CONFIG, {
      assembly: 'hg38',
      loc: CCL3L1_CONTEXT_WINDOW,
      tracks: [
        {
          trackId: 'ncbi_refseq_hg38',
          type: 'LinearBasicDisplay',
          displayMode: 'compact',
          height: 80,
        },
        {
          ...CN_HEATMAP_SETTINGS,
          trackId: 'cnv_1000g_zarr',
          // 2504 rows, so every individual is a sub-pixel line and the pattern
          // lives in the stack rather than in any one row (as in the TCGA
          // cohort figure). Below about this height the display warns that the
          // rows have collapsed.
          height: 880,
          runClustering: true,
          showTree: false,
        },
      ],
    }),
    readySelector: CLUSTERED_READY,
    readyTimeout: 300000,
    viewportHeight: 1200,
    settleMs: 10000,
    // 2504 rows floored to 1px: sub-pixel row-boundary jitter between runs
    diffThreshold: 0.02,
  },

  // cnv1000g/genome_summary_bins and its two halves (genome_avg, genome_max)
  // were here and are DELETED (review: "this figure is kind of unclear, i dont
  // think users will understand the different between these. probably just
  // delete or something"). It was the whole-genome store drawn twice at one
  // slot's difference, mean over max, and the difference is a speckle of narrow
  // stripes in the lower half that a reader has to be told to look for. The
  // prose above the embed already says what summaryScoreMode does.
]
