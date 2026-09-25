// the mode names a synteny `colorBy` string held before it was a colour
// object, and the field each paints now; `default` paints no field
const LEGACY_FIELDS: Record<string, string | undefined> = {
  default: undefined,
  strand: 'strand',
  query: 'query',
  target: 'target',
  reference: 'reference',
  track: 'track',
  identity: 'identity',
  identityDiverging: 'identity',
  meanQueryIdentity: 'identity',
  mappingQuality: 'mappingQual',
  dnds: 'dnds',
}

const ATTRIBUTE_PREFIX = 'attribute:'

type Snap = Record<string, unknown>

function isSnap(value: unknown): value is Snap {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function legacyColor(colorBy: unknown, colorDomain: unknown) {
  const domain =
    Array.isArray(colorDomain) && colorDomain.length > 0
      ? { domain: colorDomain }
      : {}
  if (typeof colorBy !== 'string') {
    return colorBy ?? (Object.keys(domain).length > 0 ? domain : undefined)
  }
  if (colorBy.startsWith(ATTRIBUTE_PREFIX)) {
    return { field: colorBy.slice(ATTRIBUTE_PREFIX.length), ...domain }
  }
  if (Object.hasOwn(LEGACY_FIELDS, colorBy)) {
    const field = LEGACY_FIELDS[colorBy]
    return field === undefined ? undefined : { field, ...domain }
  }
  return colorBy
}

function liftColorBy(snap: Snap) {
  if (!('colorBy' in snap || 'colorDomain' in snap)) {
    return snap
  }
  const { colorBy, colorDomain, ...rest } = snap
  return { ...rest, color: rest.color ?? legacyColor(colorBy, colorDomain) }
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
export const LIFTED_VIEW_KEYS = ['colorBy', 'colorDomain'] as const

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
 * A linear synteny or dotplot view snapshot's older spellings of the settings
 * the view holds now, lifted into place. A v4.3.0 session held `colorBy` (a
 * mode string), `alpha` and `minAlignmentLength` on each synteny display; the
 * v5 betas held them on the view with `colorBy` the mode string and a
 * `colorDomain` beside it, then the colour object under that name; a v4
 * `init` blob holds them too. Each lands on the view, `colorBy` as `color`.
 * Share links carry every one of these.
 */
export function liftSyntenyViewSettings(snap: Snap | undefined) {
  if (!snap) {
    return snap
  }
  const { init } = snap
  const lifted = liftColorBy(liftDisplaySettings(snap))
  const liftedInit = isSnap(init) ? liftColorBy(init) : init
  return liftedInit === init ? lifted : { ...lifted, init: liftedInit }
}
