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
const CLUSTERED_READY =
  '[data-testid="multi-wiggle-display-done"][data-clustered="true"]'

// The tutorial's own config: hg38, the 2504-sample Zarr store in test_data,
// RefSeq genes and the SV map. It loads jbrowse-plugin-zarr from its published
// beta bundle at jbrowse.org/demos/zarr/, the same arrangement as
// graphgenomeviewer, so the figures below need network for the plugin itself.
const CNV_CONFIG = 'test_data/1000g_cnv/config.json'

// The 24 contigs the whole-genome store actually covers, chr-prefixed to match
// that config's hg38 (the bgzip FASTA) and the store's own refNames. Passed as
// `displayedRegionNames` so the view holds these rather than every unplaced
// contig, whose elided far-right column is clutter in a genome-wide overview.
const HG38_MAIN_CHROMS = [
  ...Array.from({ length: 22 }, (_, i) => `chr${i + 1}`),
  'chrX',
  'chrY',
]

export const cnv1000gSpecs: ScreenshotSpec[] = [
  // The hero figure. 104 individuals as one row each, clustered on this window
  // so the copy-number classes separate, over the SV map's own record of the
  // same region. The teaching point is the disagreement: depth resolves a
  // continuous ladder from zero to ten copies across two paralogous blocks,
  // while the callset holds one CNV record with three symbolic alleles, ending
  // 35 kb short of the highest-amplitude block.
  {
    mode: 'url',
    name: 'cnv1000g/ccl3l1_depth',
    url: lgvSession(DEMO_CONFIG, {
      assembly: 'hg38',
      loc: CCL3L1_WINDOW,
      tracks: [
        { trackId: GENE_TRACK, displayMode: 'compact', height: 80 },
        { trackId: SV_MAP_TRACK, height: 70 },
        {
          ...CN_HEATMAP,
          height: 470,
          runClustering: true,
          showTree: false,
        },
      ],
    }),
    readySelector: CLUSTERED_READY,
    // 104 BigWigs, each needing its header, chrom B-tree and R-tree index
    // before the first value, then a second pass for stats: minutes of
    // latency-bound fetching before clustering can even start. This is the cost
    // the tutorial's Zarr section removes.
    readyTimeout: 300000,
    viewportHeight: 900,
    settleMs: 15000,
    // One label, naming the block the figure is about and nothing more. The
    // count it spans belongs in the caption: the heatmap's scale caps at four,
    // so a "0 to 10 copies" pill over it would claim something the colors under
    // it cannot show. The callset's side of the contrast is in the caption too,
    // because the VCF track is three rows tall here and a pill over it hides
    // the records it describes.
    annotations: [
      {
        type: 'text',
        text: 'CCL3L1/CCL4L1',
        anchor: {
          track: 'pur_copynumber_1000g',
          locus: '17:36,195,000',
          fracY: 0,
          dy: -14,
        },
      },
    ],
  },

  // The same window as individual profiles instead of a heatmap. This is what
  // the heatmap is a summary of: the plateaus are flat and quantized, so a
  // reader can count copies off the y axis rather than trust a color.
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
              defaultRendering: 'multirowxy',
              height: 500,
              minScore: 0,
              maxScore: 10,
            },
          ],
        },
      ],
    }),
    readySelector: '[data-testid="multi-wiggle-display-done"]',
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
      loc: CCL3L1_WINDOW,
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

  // The two halves of the summary-bin figure. Same store, same window, same
  // settings, one slot apart: the top reads each bin's mean, the bottom its max.
  //
  // Genome-wide is the only zoom where this can be shown at all. The adapter
  // takes the coarsest level whose bins fit in a pixel, so anything narrower
  // than about 42Mb lands on a level with no summary and the two halves would
  // be identical. Here it reads bin1000000, where one bin is 100 of the store's
  // own finest bins and a 20kb amplification is 1/50th of the average.
  ...(['avg', 'max'] as const).map(mode => ({
    mode: 'url' as const,
    name: `cnv1000g/genome_${mode}`,
    url: sessionSpec(CNV_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          displayedRegionNames: HG38_MAIN_CHROMS,
          tracks: [
            {
              ...CN_HEATMAP_SETTINGS,
              trackId: 'cnv_1000g_zarr_wg',
              summaryScoreMode: mode,
              height: 420,
              // Not clustered, unlike the window figures. Clustering is scoped
              // to the visible region, so genome-wide it would order the rows
              // by whole-genome similarity and the two halves would sort
              // differently, which is the one thing this figure cannot afford:
              // a row has to be the same individual in both.
              showTree: false,
            },
          ],
        },
      ],
    }),
    readyTimeout: 300000,
    viewportHeight: 560,
    settleMs: 10000,
    diffThreshold: 0.02,
  })),

  {
    mode: 'compose',
    name: 'cnv1000g/genome_summary_bins',
    parts: ['cnv1000g/genome_avg', 'cnv1000g/genome_max'],
    // Stacked rather than side by side, against the usual rule for one view
    // drawn two ways: the x axis is genomic coordinate, so stacking is what
    // puts a locus in the top half directly above itself in the bottom.
    direction: 'vertical',
  },
]
