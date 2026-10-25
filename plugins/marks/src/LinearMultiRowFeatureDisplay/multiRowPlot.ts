import type { MarkSnapshot } from '../LinearMarkDisplay/markProblems.ts'
import type { DefaultPlot } from '../LinearMarkDisplay/plotDefault.ts'
import type { PlotFields } from '../LinearMarkDisplay/scanPlotFields.ts'

/** A rect per feature. */
export const BLOCK_MARKS: MarkSnapshot[] = [{ mark: 'rect' }]

/** Each feature's span as a line, and its blocks over it. */
export const SPLICED_MARKS: MarkSnapshot[] = [
  { mark: { type: 'rect', height: { band: 0 } } },
  { mark: 'rect', transform: [{ type: 'flatten', keepEmpty: true }] },
]

const PREFERRED_ROWS_FIELD = 'repClass'
const FALLBACK_ROWS_FIELD = 'name'

/**
 * A painting off the scanned fields: a row per adapter source where it
 * lists several, else per `repClass` where the features carry one, else
 * per `name`; a feature's blocks joined by a line where the features are
 * spliced; and each feature its own BED color where the file states any.
 */
export function multiRowPlot(fields: PlotFields): DefaultPlot {
  const attributes = fields.attributes ?? []
  return {
    marks: fields.spliced ? SPLICED_MARKS : BLOCK_MARKS,
    rows:
      fields.rows ??
      (attributes.includes(PREFERRED_ROWS_FIELD)
        ? PREFERRED_ROWS_FIELD
        : FALLBACK_ROWS_FIELD),
    ...(fields.bedColored ? { color: { scale: { type: 'identity' } } } : {}),
  }
}
