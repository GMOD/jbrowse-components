// v4.3.0's synteny `colorBy` modes and the field each paints now; `default`
// paints no field
const V4_FIELDS: Record<string, string | undefined> = {
  default: undefined,
  strand: 'strand',
  query: 'query',
  identity: 'identity',
  meanQueryIdentity: 'identity',
  mappingQuality: 'mapq',
}

type Snap = Record<string, unknown>

function isSnap(value: unknown): value is Snap {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function liftColorBy(snap: Snap) {
  if (!('colorBy' in snap)) {
    return snap
  }
  const { colorBy, ...rest } = snap
  const field = typeof colorBy === 'string' ? V4_FIELDS[colorBy] : undefined
  return {
    ...rest,
    color: rest.color ?? (field === undefined ? undefined : { field }),
  }
}

// the displays a v4.3.0 session held these settings on: each level's tracks on
// a linear synteny view, the view's own tracks on a dotplot
function displaySnapshots(snap: Snap) {
  const levels = Array.isArray(snap.levels) ? snap.levels : []
  const tracks = [
    ...levels.flatMap(level =>
      isSnap(level) && Array.isArray(level.tracks) ? level.tracks : [],
    ),
    ...(Array.isArray(snap.tracks) ? snap.tracks : []),
  ]
  return tracks.flatMap(track =>
    isSnap(track) && Array.isArray(track.displays)
      ? track.displays.filter(isSnap)
      : [],
  )
}

const DISPLAY_SETTINGS = ['colorBy', 'alpha', 'minAlignmentLength'] as const

/**
 * #api
 * The view keys `liftSyntenyViewSettings` converts, which the two views name
 * as their launch keys' `passThrough` so a validator accepts them.
 */
export const LIFTED_VIEW_KEYS = ['colorBy'] as const

/**
 * #api
 * The display keys `liftSyntenyViewSettings` moves onto the view, by display
 * type, for a validator reading a v4.3.0 session.
 */
export const LIFTED_DISPLAY_KEYS: Record<string, readonly string[]> = {
  LinearSyntenyDisplay: DISPLAY_SETTINGS,
  DotplotDisplay: DISPLAY_SETTINGS,
}

function liftDisplaySettings(snap: Snap) {
  const displays = displaySnapshots(snap)
  const lifted = Object.fromEntries(
    DISPLAY_SETTINGS.flatMap(key => {
      const display = displays.find(d => d[key] !== undefined)
      return display && snap[key] === undefined ? [[key, display[key]]] : []
    }),
  )
  return Object.keys(lifted).length > 0 ? { ...lifted, ...snap } : snap
}

/**
 * #api
 * A linear synteny or dotplot view snapshot's v4.3.0 settings, lifted onto the
 * view: `colorBy` (a mode string), `alpha` and `minAlignmentLength` sat on each
 * synteny display, and `colorBy` lands as `color`. Launch links the genomes
 * portal handed out carry the mode string on the view itself, which lifts the
 * same way.
 */
export function liftSyntenyViewSettings(snap: Snap | undefined) {
  return snap ? liftColorBy(liftDisplaySettings(snap)) : snap
}
