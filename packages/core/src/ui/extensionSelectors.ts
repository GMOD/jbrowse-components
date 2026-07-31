import { matchTrackId } from '../util/matchTrackId.ts'

/**
 * The track-scoping fields every extension point selector shares. Both points
 * they scope (`Core-replaceWidget`, `Core-extraFeaturePanel`) fire for every
 * track, so without a selector a contribution applies to all of them.
 */
// #region fields
export interface TrackSelectorFields {
  /** track type, e.g. `'VariantTrack'`, usually what "for my tracks" means */
  trackType?: string | string[]
  /** track id; a plain string also matches the user's copies of that track */
  trackId?: string | RegExp | (string | RegExp)[]
}
// #endregion

/** the model fields a declarative selector can match on */
export interface SelectableModel {
  type?: string
  trackId?: string
  trackType?: string
}

// "Copy track" appends `-${Date.now()}` to the trackId (copyTrackSnapshot), and
// copying a copy appends again, so a bare id in a selector means "this track,
// including the user's copies of it". Doing this in the framework is the point:
// scoping by `trackId ===` is what people write by hand, and it silently stops
// applying the moment a user copies the track.
function matchesTrackId(trackId: string | undefined, pattern: string | RegExp) {
  return typeof pattern === 'string'
    ? trackId === pattern ||
        (trackId?.startsWith(`${pattern}-`) === true &&
          trackId
            .slice(pattern.length + 1)
            .split('-')
            .every(part => /^\d+$/.test(part)))
    : matchTrackId(trackId, [pattern])
}

function matchesOneOf(value: string | undefined, expected: string | string[]) {
  return typeof expected === 'string'
    ? value === expected
    : expected.includes(value ?? '')
}

/**
 * Whether `model` satisfies every declarative field of `select`. A selector's
 * `where` predicate is applied by its own helper, which knows the props type it
 * receives.
 */
export function selectorMatchesModel(
  select: (TrackSelectorFields & { widgetType?: string | string[] }) | undefined,
  model: SelectableModel,
) {
  const { widgetType, trackType, trackId } = select ?? {}
  return (
    (widgetType === undefined || matchesOneOf(model.type, widgetType)) &&
    (trackType === undefined || matchesOneOf(model.trackType, trackType)) &&
    (trackId === undefined ||
      (Array.isArray(trackId) ? trackId : [trackId]).some(pattern =>
        matchesTrackId(model.trackId, pattern),
      ))
  )
}
