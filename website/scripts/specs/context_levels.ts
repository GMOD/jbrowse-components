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
export const contextLevelsSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'context_levels',
    viewportHeight: 760,
    url: sessionSpec(VOLVOX, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:20,000-21,000',
          tracks: [{ trackId: 'volvox_alignments', height: 180 }],
          contextLevels: [
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              hideHeader: true,
              windowWidthBp: 50000,
              tracks: [{ trackId: 'gff3tabix_genes', height: 80 }],
            },
            {
              type: 'LinearGenomeView',
              assembly: 'volvox',
              hideHeader: true,
              windowWidthBp: 10000,
              tracks: [{ trackId: 'volvox_microarray', height: 80 }],
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
