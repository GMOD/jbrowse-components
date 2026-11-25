import type { ViewTrackLabelMode } from './types.ts'

/**
 * The label mode a stack of linear genome views shows: the one every row
 * shows, else `offset`.
 */
export function stackTrackLabels(
  views: readonly { effectiveTrackLabels: ViewTrackLabelMode }[],
) {
  const [first, ...rest] = views.map(view => view.effectiveTrackLabels)
  return first !== undefined && rest.every(mode => mode === first)
    ? first
    : 'offset'
}
