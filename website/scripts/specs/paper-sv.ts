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

const FONT = 18
// two lines for "chr13 breakend", so it stays clear of the row labels
const ONE_LINE = { fontSize: FONT, strokeWidth: 3 }
const STYLE = { ...ONE_LINE, maxWidth: FONT * 5 }
// from a breakend band's top down to its record in the SV calls track
const TO_CALL = 40
const CHR13 = BAND
const CHR3 = `${BAND} ~ ${BAND}`

const partLabel = (part: number, text: string): Annotation => ({
  type: 'text',
  text,
  fontSize: 48,
  anchor: {
    selector: `[data-part="${part}"]`,
    alignX: 'left',
    alignY: 'top',
    dx: -48,
    dy: 60,
  },
})

const PAPER = { hideAppBar: true, hideViewHeader: true, width: 820 }

export const paperSvSpecs: ScreenshotSpec[] = [
  junctionScaffold('paper/sv_junction_scaffold', {
    ...PAPER,
    level: 60,
    reads: 250,
    assemblyReads: 90,
    readRowHeight: 3,
    readArcs: 60,
    coverage: 20,
    trim: 90,
    annotations: [
      rowLabel('hap1, same reads', 1, FONT),
      // facing each other over the chromosome boundary, above the read curves
      callout(
        'chr13 breakend',
        { selector: CHR13, view: [0, 0], alignY: 'top', dy: TO_CALL },
        130,
        -2,
        STYLE,
      ),
      callout(
        'chr3 breakend',
        { selector: CHR3, view: [0, 0], alignY: 'top', dy: TO_CALL },
        -50,
        -2,
        STYLE,
      ),
      junction(1, STYLE),
      bandLabel('SV calls', 'draft benchmark somatic SVs', 30, FONT),
      bandLabel('aggregate\nread links', READS, 56, FONT),
      bandLabel('split reads', READS, 143, FONT),
      bandLabel('unsplit reads', READS, 212, FONT),
    ],
  }),
  scaffoldOverview('paper/sv_scaffold_overview', {
    ...PAPER,
    level: 60,
    trim: 100,
    annotations: [
      rowLabel('hap2', 0, FONT),
      rowLabel('GRCh38', 1, FONT),
      rowLabel('hap1', 2, FONT),
      callout(
        'chr13 breakend',
        { selector: CHR13, view: [0, 1], alignY: 'top' },
        -40,
        30,
        ONE_LINE,
      ),
      callout(
        'chr3 breakend',
        { selector: CHR3, view: [0, 1], alignY: 'top' },
        -50,
        30,
        ONE_LINE,
      ),
      junction(2, STYLE),
    ],
  }),
  {
    mode: 'compose',
    name: 'paper/sv_translocation',
    parts: ['paper/sv_junction_scaffold', 'paper/sv_scaffold_overview'],
    gutter: 16,
    // room for the part labels, which would cover each view's menu
    sideMargin: 60,
    annotations: [partLabel(0, 'a'), partLabel(1, 'b')],
  },
]
