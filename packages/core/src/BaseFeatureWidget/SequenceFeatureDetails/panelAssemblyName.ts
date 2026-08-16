import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { SessionAssemblies } from '../../util/tracks.ts'

/**
 * Which assembly the sequence panel fetches this feature's bases from.
 *
 * The containing view's first assembly is only a proxy for the feature's own.
 * A clicked synteny ribbon opens its details against the LinearSyntenyView,
 * whose `assemblyNames` holds every row's, so the first is whichever genome
 * sits on top — not the one the clicked side is on. The two sides normally
 * share refNames (`chr1` in both), so picking wrong does not error: it renders
 * another genome's sequence under the feature's coordinates, which is worse.
 *
 * A feature naming its own assembly therefore wins, but only if the session can
 * open it. An unknown name would trade a wrong readout for a failed fetch, and
 * a view assembly that at least exists beats that.
 */
export function panelAssemblyName({
  feature,
  viewAssemblyNames,
  assemblyManager,
}: {
  feature: SimpleFeatureSerialized
  viewAssemblyNames: string[] | undefined
  assemblyManager: SessionAssemblies
}) {
  const fallback = viewAssemblyNames?.[0]
  // SimpleFeatureSerialized is open-ended, so this arrives as `unknown`
  const own = feature.assemblyName
  if (typeof own !== 'string' || !own) {
    return fallback
  }
  const canonical = assemblyManager.getCanonicalAssemblyName(own) ?? own
  return assemblyManager.has(canonical) ? canonical : fallback
}
