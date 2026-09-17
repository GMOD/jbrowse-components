import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  VOLVOX,
  cascadeBoxes,
  lgvSession,
  menuCascade,
  sessionSpec,
} from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// Figures for the context levels section of basic_usage.md: a linear genome
// view with two wider views of the same locus stacked above its tracks.
//
// Each level is a LinearGenomeView of its own under `contextLevels`, so a
// session spec writes one the way it writes the view: tracks by id, and a
// `windowWidthBp` for how wide it is. Regions and centre come from the host.
// `hideHeader` is what the menu's own "Add context level" sets, so the figure
// shows the stack a reader gets by clicking rather than a hand-authored one.
//
// COLO829 on hg38 rather than volvox (review: "in general, volvox examples are
// weak. use human if possible. human genome much larger"): the three levels
// then span 5 Mb, 200 kb and a kilobase of the same locus, which is the range
// the feature exists for, and each level carries the track that is legible at
// its own width — coverage, genes, reads.
const CANCER_SV = encodeURIComponent(
  'https://jbrowse.org/demos/cancer_sv/config.json',
)
export const contextLevelsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'context_levels',
    viewportHeight: 820,
    url: sessionSpec(CANCER_SV, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:7,676,000-7,677,000',
          tracks: [
            {
              trackId: 'COLO829_tumor_ont',
              type: 'LinearAlignmentsDisplay',
              height: 260,
              forceLoad: true,
            },
          ],
          contextLevels: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              hideHeader: true,
              windowWidthBp: 5_000_000,
              tracks: [{ trackId: 'COLO829_tumor_coverage', height: 80 }],
            },
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              hideHeader: true,
              windowWidthBp: 200_000,
              tracks: [
                {
                  trackId: 'ncbi_refseq_hg38',
                  type: 'LinearBasicDisplay',
                  showOnlyGenes: true,
                  displayMode: 'compact',
                  height: 80,
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
    name: 'context_levels_menu',
    viewportHeight: 820,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:20,000-21,000',
      tracks: ['volvox_alignments'],
    }),
    readyText: 'ctgA',
    settleMs: 4000,
    actions: [
      { type: 'click', selector: '[data-testid="view_menu_icon"]' },
      ...menuCascade(['Add context level']),
    ],
    annotations: [
      {
        type: 'circle',
        anchor: { selector: '[data-testid="view_menu_icon"]' },
      },
      ...cascadeBoxes(['Add context level']),
    ],
  },
]
