// The JBrowse 2 v5 paper's structural variant figure, which the paper repo
// syncs from figures.lock. Its two parts are SV tutorial figures without the
// app bar.
import { junctionScaffold, scaffoldOverview } from './cgiab-junction.ts'

import type { Annotation, ScreenshotSpec } from '../screenshot-spec-types.ts'

const partLabel = (part: number, text: string): Annotation => ({
  type: 'text',
  text,
  fontSize: 44,
  anchor: {
    selector: `[data-part="${part}"]`,
    alignX: 'left',
    alignY: 'top',
    dx: -68,
    dy: 64,
  },
})

const HIDE = { hideAppBar: true }

export const paperSvSpecs: ScreenshotSpec[] = [
  junctionScaffold('paper/sv_junction_scaffold', HIDE),
  scaffoldOverview('paper/sv_scaffold_overview', HIDE),
  {
    mode: 'compose',
    name: 'paper/sv_translocation',
    parts: ['paper/sv_junction_scaffold', 'paper/sv_scaffold_overview'],
    gutter: 40,
    // room for the part labels, which would cover each view's menu
    sideMargin: 84,
    annotations: [partLabel(0, 'a'), partLabel(1, 'b')],
  },
]
