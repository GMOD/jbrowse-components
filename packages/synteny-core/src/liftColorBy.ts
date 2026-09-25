// the mode names a view's `colorBy` string held before it was a colour
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

function liftOne(snap: Record<string, unknown>) {
  if (!('colorBy' in snap || 'colorDomain' in snap)) {
    return snap
  }
  const { colorBy, colorDomain, ...rest } = snap
  return { ...rest, color: rest.color ?? legacyColor(colorBy, colorDomain) }
}

/**
 * #api
 * A linear synteny or dotplot view snapshot's `colorBy`, lifted into `color`,
 * on the view and in a v4 `init` blob: the mode string a v4 session holds,
 * with the `colorDomain` beside it, or the colour object the views held under
 * that name before it took the name every other colour object has. Share
 * links carry both spellings.
 */
export function liftColorBy(snap: Record<string, unknown> | undefined) {
  if (!snap) {
    return snap
  }
  const { init } = snap
  const lifted = liftOne(snap)
  const liftedInit =
    init !== null && typeof init === 'object' && !Array.isArray(init)
      ? liftOne(init as Record<string, unknown>)
      : init
  return liftedInit === init ? lifted : { ...lifted, init: liftedInit }
}
