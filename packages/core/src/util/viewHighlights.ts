import { isSameAssemblyName } from './tracks.ts'

import type { HighlightType } from './highlights.ts'
import type { AssemblyNameResolver } from './tracks.ts'

export function highlightsOnAssemblies(
  highlights: readonly HighlightType[],
  assemblyNames: Iterable<string>,
  assemblyManager: AssemblyNameResolver,
) {
  const names = [...assemblyNames]
  return highlights.filter(h =>
    names.some(a => isSameAssemblyName(a, h.assemblyName, assemblyManager)),
  )
}
