import { matchTrackId } from '../util/matchTrackId.ts'

/**
 * Which tracks a contribution is for. Every track-scoped extension point fires
 * for every track, so a contribution with no selector applies to all of them.
 * {@link ForTrack} is what applies one.
 */
// #region fields
export interface TrackSelector {
  /** track type, e.g. `'VariantTrack'`, usually what "for my tracks" means */
  trackType?: string | string[]
  /** track id; a plain string also matches the user's copies of that track */
  trackId?: string | RegExp | (string | RegExp)[]
  /** widget model type, e.g. `'AlignmentsFeatureWidget'`, for the slot points */
  widgetType?: string | string[]
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

/** Whether `model` satisfies every declarative field of `select`. */
export function selectorMatchesModel(
  select: TrackSelector | undefined,
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
