import { isSameAssemblyName } from '@jbrowse/core/util/tracks'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The assemblies a comparative adapter config names, spelled as it spells
 * them: `assemblyNames`, or the `queryAssembly`/`targetAssembly` pair the
 * pairwise adapters also accept. The snapshot-side twin of comparative-adapters'
 * `getAssemblyNamesFromConf`.
 */
export function adapterAssemblyNames(adapterConfig: Record<string, unknown>) {
  const { assemblyNames, queryAssembly, targetAssembly } = adapterConfig
  return Array.isArray(assemblyNames) && assemblyNames.length > 0
    ? (assemblyNames as string[])
    : [queryAssembly, targetAssembly].filter(
        (name): name is string => typeof name === 'string',
      )
}

/**
 * Regions respelled into the namespace an adapter compares against: each
 * `assemblyName` becomes the entry of `assemblyNames` the session resolves to
 * the same assembly, and stays as written where none does.
 *
 * A view names its assembly canonically and a track is free to declare an
 * alias; the worker has no assembly manager, so an adapter's `facingSides` and
 * the `===` behind a blocks table compare config text and answer nothing for
 * the alias. Resolve an assembly name before the RPC, not after
 * (`REFNAME_NAMESPACES.md`).
 */
export function regionsInAssemblyNamespace<T extends { assemblyName: string }>(
  regions: T[],
  assemblyNames: string[],
  assemblyManager: AssemblyNameResolver,
): T[] {
  return regions.map(region => {
    const spelled = assemblyNames.find(name =>
      isSameAssemblyName(name, region.assemblyName, assemblyManager),
    )
    return spelled === undefined || spelled === region.assemblyName
      ? region
      : {
          ...(isStateTreeNode(region)
            ? getSnapshot(region as IStateTreeNode)
            : region),
          assemblyName: spelled,
        }
  })
}
