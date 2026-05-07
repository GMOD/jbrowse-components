export interface ScreenshotAction {
  type: 'click' | 'waitForText' | 'delay'
  selector?: string
  text?: string
  ms?: number
}

// Mode 1: navigate to app, interact via UI to open tracks.
// This is the reliable approach — plugins are fully loaded before tracks open.
interface LGVSpec {
  mode?: 'lgv'
  name: string
  config?: string // defaults to volvox config
  loc?: string // location to navigate to (default: config default)
  openTracks?: string[] // track IDs to click open in the track selector
  crop?: { x: number; y: number; width: number; height: number }
  settleMs?: number
  actions?: ScreenshotAction[]
}

// Mode 2: navigate directly to a session spec URL.
// Use for multi-view layouts (dotplot, synteny) where the UI approach is awkward.
interface SessionUrlSpec {
  mode: 'url'
  name: string
  url: string // full query string starting with '?' or a full URL
  readyText?: string // text to wait for before settle
  readySelector?: string // CSS selector to wait for before settle
  crop?: { x: number; y: number; width: number; height: number }
  settleMs?: number
  actions?: ScreenshotAction[]
}

export type ScreenshotSpec = LGVSpec | SessionUrlSpec

const VOLVOX = 'test_data/volvox/config.json'
const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
const SYNTENY_CONFIG = 'test_data/grape_peach_synteny/config.json'
const METHYLATION_CONFIG = 'test_data/methylation_test/config.json'
const HIC_CONFIG = 'extra_test_data/hic_integration_test.json'
const DEMO_CONFIG = 'test_data/config_demo.json'
const CGIAB_BASE =
  'https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json'

function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

function cgiabUrl(session?: object) {
  if (!session) {
    return CGIAB_BASE
  }
  return `${CGIAB_BASE}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
}

export const specs: ScreenshotSpec[] = [
  {
    name: 'volvox_alignments',
    loc: 'ctgA:1-20000',
    openTracks: ['volvox_alignments'],
    settleMs: 4000,
  },

  {
    name: 'alignments',
    loc: 'ctgA:1-10000',
    openTracks: ['volvox_cram_alignments'],
    settleMs: 4000,
  },

  {
    name: 'volvox_variants',
    loc: 'ctgA:1-50000',
    openTracks: ['volvox_sv_test'],
    settleMs: 3000,
  },

  {
    name: 'variant_with_pileup',
    loc: 'ctgA:1-10000',
    openTracks: ['volvox_test_vcf', 'volvox_alignments'],
    settleMs: 4000,
  },

  {
    name: 'bigwig_xyplot',
    loc: 'ctgA:1-50000',
    openTracks: ['volvox_microarray'],
    settleMs: 4000,
  },

  {
    name: 'bigwig_line',
    loc: 'ctgA:1-50000',
    openTracks: ['volvox_microarray_line'],
    settleMs: 4000,
  },

  {
    name: 'bigwig/whole_genome_coverage',
    loc: 'ctgA:1-50000',
    openTracks: ['volvox_microarray_multi'],
    settleMs: 4000,
  },

  {
    name: 'sequence_track',
    loc: 'ctgA:1-200',
    openTracks: ['gff3tabix_genes'],
    settleMs: 3000,
  },

  {
    name: 'alignments_soft_clipped',
    loc: 'ctgA:1-10000',
    openTracks: ['volvox_samspec_cram'],
    settleMs: 4000,
  },

  {
    name: 'linear_longread',
    loc: 'ctgA:1-50000',
    openTracks: ['volvox-long-reads-cram'],
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'alignments/arc_display',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_sv_cram',
              displaySnapshot: { type: 'LinearArcDisplay' },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'alignments/read_cloud',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50000',
          tracks: [
            {
              trackId: 'volvox_sv_cram',
              displaySnapshot: { type: 'LinearReadCloudDisplay' },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
  },

  {
    mode: 'url',
    name: 'dotplot',
    url: sessionSpec(DOTPLOT_CONFIG, {
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'grape' }, { assembly: 'peach' }],
          tracks: ['dotplot_track_small'],
        },
      ],
    }),
    settleMs: 10000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    url: sessionSpec(SYNTENY_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_synteny_tblastx'],
          views: [
            { loc: 'Pp01:1-5000000', assembly: 'peach' },
            { loc: 'chr1:1-5000000', assembly: 'grape' },
          ],
        },
      ],
    }),
    settleMs: 6000,
  },

  {
    mode: 'url',
    name: 'alignments_track_arcs',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: ['spliced'],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
  },

  {
    mode: 'url',
    name: 'hic_track',
    url: sessionSpec(HIC_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          loc: 'chr1:1-10000000',
          tracks: ['hic_test'],
        },
      ],
    }),
    readySelector: '[data-testid="hic_canvas_done"]',
    settleMs: 3000,
  },

  // methylation coloring using local test data
  {
    mode: 'url',
    name: 'modifications',
    url: `?config=${METHYLATION_CONFIG}&sessionName=Screenshot`,
    readyText: '20',
    settleMs: 5000,
  },

  // COLO829 methylation (requires network — loads from public S3/jbrowse.org)
  {
    mode: 'url',
    name: 'methylation/per_read_mod_bam',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20:10,000,000-10,002,000',
          tracks: [
            {
              trackId: 'COLO829_tumor.ht',
              displaySnapshot: {
                PileupDisplay: { colorBy: { type: 'methylation' } },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'chr20',
    settleMs: 10000,
  },

  {
    mode: 'url',
    name: 'methylation/colo829_cram_and_bedmethyl',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr20:10,000,000-10,002,000',
          tracks: [
            {
              trackId: 'COLO829_tumor.ht',
              displaySnapshot: {
                PileupDisplay: { colorBy: { type: 'methylation' } },
              },
            },
            'COLO829_tumor.ht_modkit.bed_multi',
          ],
        },
      ],
    }),
    readyText: 'chr20',
    settleMs: 12000,
  },

  // Gallery page + sv_visualization.md screenshots (live sessions from jbrowse.org)

  {
    mode: 'url',
    name: 'sv_inspector_importform_loaded',
    url: sessionSpec(DEMO_CONFIG, {
      views: [
        {
          type: 'SvInspectorView',
          tracks: ['breast_cancer_sniffles_hg19_traonly_tabix'],
        },
      ],
    }),
    readyText: 'chr1',
    settleMs: 10000,
  },

  {
    mode: 'url',
    name: 'sv_inspector_begin',
    url: sessionSpec(VOLVOX, {
      views: [{ type: 'SvInspectorView' }],
    }),
    readyText: 'SV Inspector',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'horizontally_flip',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-6pkcSXlbFL&password=ER28C',
    readyText: 'chr',
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'cnv',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-AcZSrC_yOb&password=e7b64',
    readyText: 'chr',
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'skbr3_translocation',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-Swq8pJTX0z&password=yM41l',
    readyText: 'chr',
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'smalldel',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-psOr2x2efp&password=bErZE',
    readyText: 'chr20',
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'insertion',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data/config_demo.json&session=share-oTyYRpz9fN&password=fYAbt',
    readyText: 'chr1',
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'multisv',
    url: 'https://jbrowse.org/code/jb2/latest/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw',
    readyText: 'chr19',
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'breakpoint_split_view',
    url: 'https://jbrowse.org/code/jb2/latest/?config=test_data%2Fconfig_demo.json&session=share-pjaAq1hNxB&password=Z9teR',
    readyText: 'chr',
    settleMs: 12000,
  },

  // Alignments track doc screenshots (local volvox data)

  {
    name: 'alignment_clipping_indicators',
    loc: 'ctgA:1-10000',
    openTracks: ['volvox_cram_alignments'],
    settleMs: 4000,
  },

  {
    name: 'insertion_indicators',
    loc: 'ctgA:1-50000',
    openTracks: ['volvox-long-reads-cram'],
    settleMs: 4000,
  },

  {
    mode: 'url',
    name: 'inverted_duplication',
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-20000',
          tracks: [
            {
              trackId: 'volvox-simple-inv-paired.cram',
              displaySnapshot: {
                PileupDisplay: { colorBy: { type: 'orientation' } },
              },
            },
          ],
        },
      ],
    }),
    readyText: 'ctgA',
    settleMs: 5000,
  },

  // C-GIAB live demo screenshots (load from jbrowse.org, not local test data)

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_start',
    url: cgiabUrl(),
    readyText: 'Structural Variant Inspector',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/translocation_sv_inspector_view',
    url: cgiabUrl({
      views: [
        {
          type: 'SvInspectorView',
          tracks: [
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
          ],
        },
      ],
    }),
    readyText: 'chr1',
    settleMs: 10000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_show_all_regions',
    url: cgiabUrl({
      views: [{ type: 'LinearGenomeView', assembly: 'GRCh38_GIABv3' }],
    }),
    readyText: 'Show all regions in assembly',
    settleMs: 3000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/deletion_linear_view',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5:97050000-97400000',
          tracks: [
            'GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf',
            'HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    settleMs: 15000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/cnv_with_bed_track',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38_GIABv3',
          loc: 'chr5:1-180915260',
          tracks: [
            'HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram.all',
            'GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls',
          ],
        },
      ],
    }),
    readyText: 'chr5',
    settleMs: 12000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/dotplot_result',
    url: cgiabUrl({
      views: [
        {
          type: 'DotplotView',
          views: [{ assembly: 'HG008T.hap1' }, { assembly: 'GRCh38_GIABv3' }],
          tracks: ['HG008T.hap1'],
        },
      ],
    }),
    settleMs: 20000,
  },

  {
    mode: 'url',
    name: 'sv_cgiab/synteny_view',
    url: cgiabUrl({
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['HG008T.hap1'],
          views: [
            {
              loc: 'chr3:1-198295559 chr13:1-114364328',
              assembly: 'GRCh38_GIABv3',
            },
            {
              loc: 'haplotype1-0000015:1-300000000 haplotype1-0000016:1-300000000',
              assembly: 'HG008T.hap1',
            },
          ],
        },
      ],
    }),
    readyText: 'chr3',
    settleMs: 15000,
  },
]
