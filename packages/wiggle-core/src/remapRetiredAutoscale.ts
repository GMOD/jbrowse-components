const RETIRED_AUTOSCALE: Record<string, string> = {
  global: 'local',
  globalsd: 'localsd',
}

function mapRetiredAutoscale(value: unknown): unknown {
  return typeof value === 'string' && value in RETIRED_AUTOSCALE
    ? RETIRED_AUTOSCALE[value]
    : value
}

/**
 * A `preProcessSnapshot` for a schema spreading `scoreAxisConfigSchemaFields`:
 * maps the retired `global`/`globalsd` autoscale values an old config may carry
 * onto their local equivalents, which the narrowed enum accepts.
 */
export function remapRetiredAutoscale(snap: Record<string, unknown>) {
  const autoscale = mapRetiredAutoscale(snap.autoscale)
  return autoscale === snap.autoscale ? snap : { ...snap, autoscale }
}
