import type { LinearAlignmentsDisplayModel } from './model.ts'

/**
 * #api
 * Whether a track's display is the reads display, for a host that reaches it
 * through `view.getTrack(id)?.activeDisplay` to drive its own controls.
 */
export function isLinearAlignmentsDisplay(
  display: unknown,
): display is LinearAlignmentsDisplayModel {
  return (
    (display as { type?: unknown } | undefined)?.type ===
    'LinearAlignmentsDisplay'
  )
}
