import { readConfObject } from '../configuration/index.ts'

import type { AnyConfigurationModel } from '../configuration/index.ts'

interface SessionWithTemporaryAssemblies {
  temporaryAssemblies?: { name?: string }[]
}

/**
 * Whether a track config names an assembly the session holds as **temporary** —
 * the read-vs-ref pair a comparative view synthesizes, which goes away when that
 * view closes (`releaseTemporaryAssemblies`).
 *
 * `some`, not `every`: a config half of whose assemblies survive is still one
 * nothing can draw once the other half is gone, and unlike a sweep that DELETES
 * a config this question never has to decide whose it is. The `every`/`some`
 * distinction is what made the session-track sweep ADR-084 removed a judgment
 * call; a question asked at the moment of the write has no such problem.
 *
 * Down here rather than beside the contract check that started it
 * (`product-core/Session/temporaryAssemblyTracks.ts`) because two callers now
 * ask it and they are on opposite sides of the dependency: the check and the
 * track menu's copy guard in product-core, and `addTrackFromWidget` in this
 * package, which routes a track around the session lists entirely when the
 * answer is yes. A second copy of the predicate is the thing to avoid — a copied
 * guard is where the escape clause gets added to only one of them.
 */
export function namesTemporaryAssembly(
  session: unknown,
  trackConf: AnyConfigurationModel | Record<string, unknown>,
) {
  const temporary = (session as SessionWithTemporaryAssemblies)
    .temporaryAssemblies
  if (!temporary?.length) {
    return false
  }
  const names = readConfObject(
    trackConf as AnyConfigurationModel,
    'assemblyNames',
  ) as string[] | undefined
  return !!names?.some(name => temporary.some(a => a.name === name))
}
