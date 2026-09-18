import { displayPainted } from '@jbrowse/browser-test-utils'

import { VOLVOX, lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the detail levels section of basic_usage.md: a linear genome view
// with two closer views of the same locus stacked under its tracks.
//
// Each level is a LinearGenomeView of its own under `detailLevels`, so a
// session spec writes one the way it writes the view: tracks by id, and a
// `windowWidthBp` for how wide it is. Regions and centre come from the host.
// `hideHeader` is what the rubberband's own "Add detail level" sets, so the
// figure shows the stack a reader gets by dragging rather than a hand-authored
// one.
//
// COLO829 on hg38 rather than volvox (review: "in general, volvox examples are
// weak. use human if possible. human genome much larger"): the three rows then
// span 2 Mb, 200 kb and 20 kb of the same locus, which is the range the feature
// exists for, and each row carries the track that is legible at its own width.
// The coverage is in 50 kb bins, so the top row is the widest window those bins
// still draw a profile in rather than a block.
const CANCER_SV = encodeURIComponent(
  'https://jbrowse.org/demos/cancer_sv/config.json',
)
export const detailLevelsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'detail_levels',
    viewportHeight: 800,
    url: sessionSpec(CANCER_SV, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:6,676,500-8,676,500',
          tracks: [{ trackId: 'COLO829_tumor_coverage', height: 110 }],
          detailLevels: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              hideHeader: true,
              windowWidthBp: 200_000,
              tracks: [
                {
                  trackId: 'ncbi_refseq_hg38',
                  type: 'LinearBasicDisplay',
                  displayMode: 'compact',
                  height: 90,
                },
              ],
            },
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              hideHeader: true,
              windowWidthBp: 20_000,
              tracks: [
                {
                  trackId: 'COLO829_tumor_ont',
                  type: 'LinearAlignmentsDisplay',
                  height: 240,
                  forceLoad: true,
                },
              ],
            },
          ],
        },
      ],
    }),
    readySelector: displayPainted('pileup-display'),
    readyTimeout: 180000,
    settleMs: 20000,
  },
  {
    mode: 'url',
    name: 'detail_levels_menu',
    viewportHeight: 420,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:20,000-21,000',
      tracks: ['volvox_alignments'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    // A drag across the view, since the span is what the item takes: dragging
    // is the gesture, and the menu that opens on release is where the figure's
    // one boxed row is.
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Add detail level' },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Add detail level' } }],
  },
]
