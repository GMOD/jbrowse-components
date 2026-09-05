import { measuredFont } from '@jbrowse/core/util'

// The one font every MAF label draws in — base cells, codons, and the insertion
// and deletion counts — carrying its own measurement so a caller reserving room
// for a count cannot measure a different font than it paints. It measured a
// monospace label against the proportional table until 2026-08-16, which the
// deletion count's padding hid for three digits; `measuredFont` is where that is
// written down.
export const LABEL_FONT = measuredFont(10, 'Courier New,monospace', 'bold')
export const CHAR_SIZE_WIDTH = 10
// The `span` shape's `seamPx` for the rows band: adjacent cell runs overlap by
// a sub-pixel so hairlines don't appear at scale ~1px/bp. Mirrors the +0.5/+0.4
// fudge used in plugin-alignments.
export const GAP_STROKE_OFFSET = 0.4
