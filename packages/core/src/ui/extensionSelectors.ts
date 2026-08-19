import { matchTrackId } from '../util/matchTrackId.ts'

/**
 * Which tracks a contribution is for. Every track-scoped extension point fires
 * for every track, so a contribution with no selector applies to all of them.
 * {@link matchesTrackSelector} is what applies one.
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
function selectorMatchesModel(
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

/**
 * What a track-scoped extension point contribution is for: whether the widget
 * model or track config in `subject` satisfies every field of `select`. Every
 * field given must match, and an empty selector matches everything.
 *
 * Every one of those points fires for every track, so a contribution that does
 * not call this applies to all of them. Hand-writing `config.trackId === 'x'`
 * instead is what silently stops applying the first time a user copies the
 * track: `copyTrackSnapshot` suffixes the id, and this knows that.
 *
 * Not to be confused with {@link matchTrackId}, which tests an id against
 * patterns you supply and so leaves that normalization to you.
 */
export function matchesTrackSelector(
  select: TrackSelector | undefined,
  subject: {
    /** a widget model, if the point's props carry one */
    model?: SelectableModel
    /** a track config, if they carry that instead — `type` is the track type */
    config?: Record<string, unknown>
  },
) {
  const { model, config } = subject
  return selectorMatchesModel(
    select,
    model ?? {
      trackId: config?.trackId as string | undefined,
      trackType: config?.type as string | undefined,
    },
  )
}
