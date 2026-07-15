// 'global'/'globalsd' autoscale were retired: they scoped stats to all loaded
// regions rather than the file, so they barely differed from local/localsd and
// were rarely used. Old configs/sessions may still carry them — map onto the
// local equivalents so the narrowed `autoscale` enum doesn't reject the snapshot.
const RETIRED_AUTOSCALE: Record<string, string> = {
  global: 'local',
  globalsd: 'localsd',
}

export function mapRetiredAutoscale(value: unknown): unknown {
  return typeof value === 'string' && value in RETIRED_AUTOSCALE
    ? RETIRED_AUTOSCALE[value]
    : value
}

export function remapRetiredAutoscale(snap: Record<string, unknown>) {
  const autoscale = mapRetiredAutoscale(snap.autoscale)
  return autoscale === snap.autoscale ? snap : { ...snap, autoscale }
}
