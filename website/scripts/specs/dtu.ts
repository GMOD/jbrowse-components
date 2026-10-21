import { displayReady, lgvSession } from '../screenshot-spec-helpers.ts'

import type { ScreenshotSpec } from '../screenshot-spec-types.ts'

// demos/dtu/config.json is the source of the hosted config.
const DTU_CONFIG = 'https://jbrowse.org/demos/dtu/config.json'

// The 37 bp exon ATP5F1C-202 keeps and ATP5F1C-201 skips (GENCODE v29).
const CASSETTE_EXON = 'chr10:7,806,974-7,807,010'

const coverage = (trackId: string) => ({
  trackId,
  height: 90,
})

// The lane's packing depends on the window, so a pinned height leaves blank
// lane or clips rows.
const glyph = {
  trackId: 'dtu_muscle_vs_liver',
  heightMode: 'grow',
}

const DTU_READY = displayReady('feature-display')

export const dtuSpecs: ScreenshotSpec[] = [
  // The window runs ~4 kb past the gene's 3' end because the opaque color key
  // pins to the track's top-right corner and would cover the last exons.
  {
    mode: 'url',
    name: 'dtu/dtu_colored_gene_glyph',
    url: lgvSession(DTU_CONFIG, {
      assembly: 'hg38',
      loc: 'chr10:7,787,600..7,812,400',
      tracks: [coverage('muscle_plus'), coverage('liver_plus'), glyph],
    }),
    readySelector: DTU_READY,
    viewportHeight: 730,
    annotations: [
      {
        // No `trackId`, so the box spans all three tracks; the pad makes the
        // ~2px exon findable.
        type: 'box',
        anchor: { loc: CASSETTE_EXON },
        pad: 9,
        strokeWidth: 3,
      },
      // Each pill ends just left of the box; a centered label lands on the box.
      {
        type: 'text',
        text: 'exon skipped',
        anchor: {
          loc: CASSETTE_EXON,
          trackId: 'muscle_plus',
          fracY: 0.5,
          alignX: 'left',
        },
        textAlign: 'end',
        dx: -14,
      },
      {
        type: 'text',
        text: 'exon retained',
        anchor: {
          loc: CASSETTE_EXON,
          trackId: 'liver_plus',
          fracY: 0.35,
          alignX: 'left',
        },
        textAlign: 'end',
        dx: -14,
      },
    ],
  },
]
