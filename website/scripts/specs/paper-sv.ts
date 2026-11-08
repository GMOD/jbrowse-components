// The JBrowse 2 v5 paper's structural variant figure, which the paper repo
// syncs from figures.lock. Its two parts are SV tutorial figures without the
// app bar, narrower and with larger callouts, since the paper prints the figure
// at its full text width.
import {
  BAND,
  READS,
  bandLabel,
  callout,
  junction,
  junctionScaffold,
  rowLabel,
  scaffoldOverview,
} from './cgiab-junction.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const FONT = 28
// two lines for "chr13 breakend", so it stays clear of the row labels
const STYLE = { fontSize: FONT, maxWidth: FONT * 5 }
const CHR13 = BAND
const CHR3 = `${BAND} ~ ${BAND}`

const partLabel = (part: number, text: string): Annotation => ({
  type: 'text',
  text,
  fontSize: 72,
  anchor: {
    selector: `[data-part="${part}"]`,
    alignX: 'left',
    alignY: 'top',
    dx: -100,
    dy: 80,
  },
})

const PAPER = { hideAppBar: true, width: 1300 }

export const paperSvSpecs: ScreenshotSpec[] = [
  junctionScaffold('paper/sv_junction_scaffold', {
    ...PAPER,
    annotations: [
      rowLabel('hap1', 1, FONT),
      // facing each other over the chromosome boundary, above the read curves
      callout(
        'chr13 breakend',
        { selector: CHR13, view: [0, 0], alignY: 'top' },
        120,
        70,
        STYLE,
      ),
      callout(
        'chr3 breakend',
        { selector: CHR3, view: [0, 0], alignY: 'top' },
        -120,
        70,
        STYLE,
      ),
      junction(1, STYLE),
      bandLabel('SV calls', 'draft benchmark somatic SVs', 31, FONT),
      bandLabel('aggregate\nread links', READS, 101, FONT),
      bandLabel('split reads', READS, 259, FONT),
      bandLabel('unsplit reads', READS, 619, FONT),
    ],
  }),
  scaffoldOverview('paper/sv_scaffold_overview', {
    ...PAPER,
    annotations: [
      rowLabel('hap2', 0, FONT),
      rowLabel('GRCh38', 1, FONT),
      rowLabel('hap1', 2, FONT),
      callout(
        'chr13 breakend',
        { selector: CHR13, view: [0, 1], alignY: 'top' },
        -150,
        40,
        STYLE,
      ),
      callout(
        'chr3 breakend',
        { selector: CHR3, view: [0, 1], alignY: 'top' },
        -150,
        40,
        STYLE,
      ),
      junction(2, STYLE),
    ],
  }),
  {
    mode: 'compose',
    name: 'paper/sv_translocation',
    parts: ['paper/sv_junction_scaffold', 'paper/sv_scaffold_overview'],
    gutter: 40,
    // room for the part labels, which would cover each view's menu
    sideMargin: 112,
    annotations: [partLabel(0, 'a'), partLabel(1, 'b')],
  },
]
