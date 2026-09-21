import { VOLVOX, lgvSession, sessionSpec } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// A linear genome view with two close-ups under it, on COLO829's hg38 demo at
// TP53. Each row is the same RefSeq track, so the only thing that changes down
// the stack is the width: 2 Mb, 200 kb, 20 kb. `hideHeader` is what the
// rubberband's "Close-up view" sets.
const CANCER_SV = encodeURIComponent(
  'https://jbrowse.org/demos/cancer_sv/config.json',
)
const genes = (height: number) => ({
  trackId: 'ncbi_refseq_hg38',
  type: 'LinearBasicDisplay',
  displayMode: 'compact',
  height,
})
export const closeUpSpecs: ScreenshotSpec[] = [
  {
    mode: 'url',
    name: 'close_ups',
    viewportHeight: 840,
    url: sessionSpec(CANCER_SV, {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          loc: 'chr17:6,676,500-8,676,500',
          tracks: [genes(130)],
          closeUps: [
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              hideHeader: true,
              windowWidthBp: 200_000,
              tracks: [genes(110)],
            },
            {
              type: 'LinearGenomeView',
              assembly: 'hg38',
              hideHeader: true,
              windowWidthBp: 20_000,
              tracks: [genes(80)],
            },
          ],
        },
      ],
    }),
    readyText: 'TP53',
    readyTimeout: 120000,
  },
  {
    mode: 'url',
    name: 'close_up_menu',
    viewportHeight: 420,
    url: lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:20,000-21,000',
      tracks: ['volvox_alignments'],
    }),
    readyText: 'ctgA',
    // A drag across the view, since the span is what the item takes: dragging
    // is the gesture, and the Launch submenu of the menu that opens on release
    // is where the figure's one boxed row is.
    actions: [
      { type: 'drag', from: { x: 300, y: 150 }, to: { x: 600, y: 150 } },
      { type: 'waitForText', text: 'Launch' },
      { type: 'hover', text: 'Launch' },
      { type: 'waitForText', text: 'Close-up view' },
      { type: 'delay', ms: 1000 },
    ],
    annotations: [{ type: 'box', anchor: { text: 'Close-up view' } }],
  },
]
