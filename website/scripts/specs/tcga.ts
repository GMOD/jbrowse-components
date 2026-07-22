import { kgUrl } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The 1000 Genomes config's hg38 assembly names its contigs bare (`1`, `X`), so
// the view's displayedRegionNames use that form. The BED's own `chr`-prefixed
// names resolve through the assembly's refNameAliases (hg38_aliases.txt maps
// 17 <-> chr17), which is why the track needs no renaming.
//
// chrY is omitted because the built BED contains no Y segments at all (checked
// against the file), so listing it would draw an empty column.
const HG38_MAIN_CHROMS = [
  ...Array.from({ length: 22 }, (_, i) => String(i + 1)),
  'X',
]

// One row per TCGA-BRCA primary tumor (1104 of them), painted from the caller's
// raw Segment_Mean on a diverging blue/red log2 scale. Built by
// scripts/build_tcga_cohort_cnv.sh from GDC open-access Masked Copy Number
// Segment files; see website/docs/tutorials/tcga_cohort_cnv.md.
const TCGA_BRCA_CNV_TRACK = {
  type: 'FeatureTrack',
  trackId: 'tcga_brca_cnv',
  name: 'TCGA-BRCA copy number (1104 primary tumors)',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'BedTabixAdapter',
    bedGzLocation: {
      uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz',
      locationType: 'UriLocation',
    },
    index: {
      indexType: 'TBI',
      location: {
        uri: 'https://jbrowse.org/demos/tcga/tcga_brca_cnv.bed.gz.tbi',
        locationType: 'UriLocation',
      },
    },
  },
  displays: [
    {
      type: 'LinearMultiRowFeatureDisplay',
      displayId: 'tcga_brca_cnv-LinearMultiRowFeatureDisplay',
      partitionField: 'sample',
      // 0 = auto-fit: the display height divided across the rows, floored at
      // 1px. At 1104 rows every tumor is a single pixel line, which is the point
      color:
        "jexl:get(feature,'segmean')<-1?'#2166ac':get(feature,'segmean')<-0.3?'#92c5de':get(feature,'segmean')<0.3?'#f7f7f7':get(feature,'segmean')<1?'#f4a582':'#b2182b'",
      rowHeight: 0,
      legend: [
        { label: 'Deep loss (log2 < -1)', color: '#2166ac' },
        { label: 'Loss', color: '#92c5de' },
        { label: 'Balanced', color: '#f7f7f7' },
        { label: 'Gain', color: '#f4a582' },
        { label: 'Amplification (log2 > 1)', color: '#b2182b' },
      ],
    },
  ],
}

// The tree sidebar only mounts once clustering has produced a hierarchy
// (TreeSidebar returns null on `!hierarchy`), so waiting on its canvas gates the
// capture on real completion rather than on a duration guess.
const CLUSTERED = '[data-testid="tree_sidebar_dendrogram"]'

export const tcgaSpecs: ScreenshotSpec[] = [
  // The cohort view: every TCGA-BRCA primary tumor as one 1px row across the
  // whole genome, clustered so tumors with similar profiles sit together.
  // Recurrent events read as vertical stripes down the stack: blue at 9p21
  // (CDKN2A) and 10q23 (PTEN), red at 17q12 (ERBB2), 8q24 (MYC) and 11q13
  // (CCND1). This is the figure the tutorial is built around.
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_genome',
    url: kgUrl({
      sessionTracks: [TCGA_BRCA_CNV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          displayedRegionNames: HG38_MAIN_CHROMS,
          trackLabels: 'offset',
          tracks: [
            {
              trackId: 'tcga_brca_cnv',
              type: 'LinearMultiRowFeatureDisplay',
              height: 760,
              // one-shot declarative trigger, cleared once the RPC lands
              runClustering: true,
              showTree: true,
            },
          ],
        },
      ],
    }),
    readySelector: CLUSTERED,
    readyTimeout: 180000,
    viewportWidth: 1900,
    viewportHeight: 900,
    settleMs: 20000,
    // 1104 rows floored to 1px: sub-pixel row-boundary jitter between runs, so
    // the gate sits above the default 0.001
    diffThreshold: 0.02,
  },

  // chr17:39.0-40.5Mb, spanning ERBB2 (39.69-39.73Mb), the HER2 of HER2-positive
  // breast cancer. Clustering runs on the visible window only, so the cohort
  // sorts into its copy-number classes at this locus rather than genome-wide.
  //
  // Note the banding is qualitative, not proportional: 1104 rows in a few
  // hundred px puts each tumor well under 1px, so rows alias and the saturated
  // colors crowd out the neutral ones. Measured off the BED the window is 70%
  // balanced, but it paints as ~52%. The tutorial states the real numbers.
  //
  // Neutral stays near-white (#f7f7f7) on purpose. A darker neutral makes this
  // figure's balanced band more obviously "data", but washes out the
  // genome-wide figure above, where the recurrent stripes are the whole point,
  // and near-white neutral is the convention for CNV heatmaps. The caption
  // names the pale band instead.
  {
    mode: 'url',
    name: 'tcga/cohort_cnv_erbb2',
    url: kgUrl({
      sessionTracks: [TCGA_BRCA_CNV_TRACK],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: '17:39,000,000-40,500,000',
          tracks: [
            {
              trackId: 'tcga_brca_cnv',
              type: 'LinearMultiRowFeatureDisplay',
              height: 700,
              runClustering: true,
              showTree: true,
            },
          ],
        },
      ],
    }),
    readySelector: CLUSTERED,
    readyTimeout: 180000,
    viewportWidth: 1500,
    viewportHeight: 820,
    settleMs: 15000,
    diffThreshold: 0.02,
  },
]
