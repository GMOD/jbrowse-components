import type { LinearBasicDisplayModel } from './model.ts'

/**
 * #api
 * Whether a track's display is the feature display, for a host that reaches
 * it through `view.getTrack(id)?.activeDisplay` to drive its own controls.
 */
export function isLinearBasicDisplay(
  display: unknown,
): display is LinearBasicDisplayModel {
  return (
    (display as { type?: unknown } | undefined)?.type === 'LinearBasicDisplay'
  )
}
