import { MULTI_SAMPLE_VARIANT_DISPLAY } from '../shared/constants.ts'

const RETIRED_MATRIX_TYPES: ReadonlySet<unknown> = new Set([
  'LinearMultiSampleVariantMatrixDisplay',
  'LinearVariantMatrixDisplay',
])

type DisplayEntry = Record<string, unknown>

function isConfigured(d: DisplayEntry) {
  return Object.keys(d).some(k => k !== 'type' && k !== 'displayId')
}

/**
 * A track config written while the matrix was a display type of its own. Its
 * entry becomes this display in columns, keeping what a reader set on it, when
 * nothing else claims the display: no entry for this display beside it, or
 * only the bare stub every track type gets. Otherwise the entry for this
 * display wins and the matrix's is dropped, as the display-type aliases alone
 * would drop it.
 */
export function foldRetiredMatrixDisplay(snap: Record<string, unknown>) {
  const { displays, trackId } = snap
  if (
    !Array.isArray(displays) ||
    !displays.some((d: DisplayEntry) => RETIRED_MATRIX_TYPES.has(d.type))
  ) {
    return snap
  }
  const entries = displays as DisplayEntry[]
  const current = entries.find(d => d.type === MULTI_SAMPLE_VARIANT_DISPLAY)
  const matrixWins = !current || !isConfigured(current)
  const stubId = `${String(trackId)}-${MULTI_SAMPLE_VARIANT_DISPLAY}`
  return {
    ...snap,
    displays: entries.flatMap(d => {
      if (RETIRED_MATRIX_TYPES.has(d.type)) {
        return matrixWins
          ? [
              {
                ...d,
                type: MULTI_SAMPLE_VARIANT_DISPLAY,
                displayId:
                  current?.displayId ??
                  (d.displayId === `${String(trackId)}-${String(d.type)}`
                    ? stubId
                    : d.displayId),
                variantLayout: 'columns',
              },
            ]
          : []
      }
      return d === current && matrixWins ? [] : [d]
    }),
  }
}
