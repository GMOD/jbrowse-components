import { displayPainted, displaySettled } from '@jbrowse/browser-test-utils'

import {
  PARK_CURSOR,
  displayReady,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'
import {
  ECOLI_AVA_STACK_HEIGHT,
  ECOLI_DEMO_BASE,
  ecoliAvaStack,
} from './demoBase.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// The hosted config's pggb tracks are newer than jbrowse.org/code/jb2/latest,
// so these figures load it against the local build.
const CONFIG = `${ECOLI_DEMO_BASE}/config.json`

// Red is the rows' own Inverted color, so no box uses it.
const UNTANGLE_ARMS = [
  {
    k12: 'chr:213,443-262,948',
    iai39: 'chr:449,188-493,004',
    color: '#ef6c00',
  },
  {
    k12: 'chr:302,899-501,436',
    iai39: 'chr:228,426-443,280',
    color: '#2e7d32',
  },
  {
    k12: 'chr:914,963-1,194,177',
    iai39: 'chr:2,058,958-2,336,701',
    color: '#6a1b9a',
  },
  {
    k12: 'chr:1,635,838-2,229,302',
    iai39: 'chr:906,630-1,574,975',
    color: '#1565c0',
  },
  {
    k12: 'chr:3,946,786-4,171,723',
    iai39: 'chr:3,083,154-3,330,675',
    color: '#00838f',
  },
]

export const pangenomeSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'pangenome/pggb_synteny',
    url: sessionSpec(CONFIG, {
      views: [ecoliAvaStack('ecoli_pggb_ava')],
    }),
    viewportHeight: ECOLI_AVA_STACK_HEIGHT,
    readySelector: displayPainted('synteny_canvas'),
    readyTimeout: 120000,
  },
  // odgi pav picks this window: all four strains are 29-40% absent in it.
  {
    mode: 'url',
    name: 'pangenome/maf',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:4,540,000-4,600,000',
          tracks: [
            { trackId: 'K12_genes' },
            {
              // `pggb -V` already flattens the snarl tree, so a length filter
              // here drops real indels.
              trackId: 'ecoli_pggb_variants',
              type: 'LinearMultiSampleVariantDisplay',
              variants: { show: true },
              // Below 170 the track clips its key's Insertions section.
              unit: 'haplotype',
              height: 170,
            },
            {
              trackId: 'ecoli_pggb_maf',
              height: 130,
            },
          ],
        },
      ],
    }),
    // No ruler tick draws at this window's left edge, so gate on the MAF.
    readySelector: displaySettled('maf-display'),
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 710,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },

  // The BED's own itemRgb (scripts/untangle_to_bed.py) colors the rows. No
  // gene lane: at 4.6 Mb the K12 genes trip the too-many-features gate.
  {
    mode: 'url',
    name: 'pangenome/pggb_untangle_rows',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:1-4,641,652',
          tracks: [
            {
              trackId: 'ecoli_pggb_untangle_rows',
              height: 240,
            },
          ],
        },
      ],
    }),
    readyText: 'untangle per strain',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 450,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
    // No `fracY`, so each box spans all four rows and the grey control rows
    // sit inside it.
    annotations: UNTANGLE_ARMS.map(({ k12, color }) => ({
      type: 'box' as const,
      color,
      strokeWidth: 3,
      anchor: { trackId: 'ecoli_pggb_untangle_rows', loc: k12 },
    })),
  },

  // The dotplot does not show the collapsed repeat: the two records sharing
  // K12 3,941,447 are a breakpoint. Keep the repeat out of its caption.
  {
    mode: 'url',
    name: 'pangenome/pggb_untangle_dotplot',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'DotplotView',
          tracks: ['ecoli_pggb_untangle'],
          // x is views[0] (hview), y is views[1] (vview)
          views: [{ assembly: 'K12' }, { assembly: 'IAI39' }],
        },
      ],
    }),
    readyTimeout: 120000,
    // the rows figure's width, so the two stack flush
    viewportWidth: 1000,
    viewportHeight: 746,
    annotations: UNTANGLE_ARMS.map(({ k12, iai39, color }) => ({
      type: 'box' as const,
      color,
      strokeWidth: 3,
      anchor: { hLoc: k12, vLoc: iai39 },
    })),
  },
  {
    mode: 'compose',
    name: 'pangenome/pggb_untangle_inversion',
    parts: ['pangenome/pggb_untangle_rows', 'pangenome/pggb_untangle_dotplot'],
  },

  // The shaded span comes from the pav bigWigs: over it IAI39 is absent while
  // NCTC86 and Sakai are present.
  {
    mode: 'url',
    name: 'pangenome/pav',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:450,000-590,000',
          // Low alpha keeps the white notch under the band visible;
          // getHighlightColor uses a supplied color as-is.
          highlight: [
            {
              refName: 'chr',
              start: 501500,
              end: 539000,
              color: 'rgba(255,193,7,0.30)',
            },
          ],
          tracks: [
            { trackId: 'K12_genes', height: 90 },
            {
              trackId: 'ecoli_pggb_depth',
              height: 150,
              encoding: {
                y: {
                  axis: { title: 'paths' },
                  rules: [
                    { value: 5, label: 'all five strains' },
                    { value: 1, label: 'K12 alone' },
                  ],
                },
              },
            },
            {
              trackId: 'ecoli_pggb_pav',
              // Matches pangenome_cactus/pav so the two builders compare.
              mark: 'rect',
              height: 240,
            },
          ],
        },
      ],
    }),
    readyText: 'per-strain presence',
    readyTimeout: 90000,
    viewportWidth: 1000,
    viewportHeight: 775,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },

  // `odgi pav` picks CPZ-55: 0x across chr:2,559,000-2,565,000. CP4-6 and
  // DLP12 are only partly carried in this isolate.
  {
    mode: 'url',
    name: 'pangenome/long_reads',
    url: sessionSpec(CONFIG, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'K12',
          loc: 'chr:2,554,000-2,570,000',
          tracks: [
            { trackId: 'K12_genes' },
            {
              trackId: 'ecoli_e146_ont',
              unit: 'chain',
              facet: 'split',
              encoding: { color: 'pairOrientation' },
              height: 210,
            },
            {
              trackId: 'ecoli_pggb_depth',
              height: 100,
            },
            {
              trackId: 'ecoli_pggb_maf',
              height: 130,
            },
          ],
        },
      ],
    }),
    // readyText on the locus would match before a single read draws.
    readySelector: displayReady('pileup-display'),
    readyTimeout: 120000,
    viewportWidth: 1000,
    viewportHeight: 865,
    tooltip: 'hide',
    actions: [PARK_CURSOR],
  },
]
