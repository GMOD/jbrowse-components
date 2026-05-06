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
  config?: string     // defaults to volvox config
  loc?: string        // location to navigate to (default: config default)
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
  url: string         // full query string starting with '?'
  readyText?: string  // text to wait for before settle
  crop?: { x: number; y: number; width: number; height: number }
  settleMs?: number
  actions?: ScreenshotAction[]
}

export type ScreenshotSpec = LGVSpec | SessionUrlSpec

const VOLVOX = 'test_data/volvox/config.json'
const DOTPLOT_CONFIG = 'test_data/config_dotplot.json'
const SYNTENY_CONFIG = 'test_data/grape_peach_synteny/config.json'

function sessionSpec(config: string, session: object) {
  return `?config=${config}&session=spec-${encodeURIComponent(JSON.stringify(session))}&sessionName=Screenshot`
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
          views: [{ assembly: 'volvox' }, { assembly: 'volvox2' }],
          tracks: ['dotplot_track_small'],
        },
      ],
    }),
    settleMs: 6000,
  },

  {
    mode: 'url',
    name: 'linear_synteny',
    url: sessionSpec(SYNTENY_CONFIG, {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['grape_peach_paf'],
          views: [
            { loc: 'Pp01:1-5000000', assembly: 'peach' },
            { loc: 'chr1:1-5000000', assembly: 'grape' },
          ],
        },
      ],
    }),
    settleMs: 6000,
  },
]
