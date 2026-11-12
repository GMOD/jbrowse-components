import {
  adapterNamespaceNames,
  isSameAssemblyName,
  spellingAmong,
} from '@jbrowse/core/util/tracks'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { AssemblyNameResolver } from '@jbrowse/core/util/tracks'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Regions respelled into the namespace a comparative adapter compares against:
 * each `assemblyName` becomes the name the adapter config spells that assembly
 * by, and stays as written where it names it by none. The track's names stand
 * in for a config naming no assembly at all.
 *
 * A view names its assembly canonically, a track and its adapter are each free
 * to declare an alias, and the worker has no assembly manager, so an adapter's
 * `facingSides` and the `===` behind a blocks table compare config text.
 * Resolve an assembly name before the RPC, not after
 * (`REFNAME_NAMESPACES.md`).
 */
export function regionsInAdapterNamespace<T extends { assemblyName: string }>(
  regions: T[],
  {
    adapterConfig,
    trackAssemblyNames,
    assemblyManager,
  }: {
    adapterConfig: Record<string, unknown>
    trackAssemblyNames?: readonly string[]
    assemblyManager: AssemblyNameResolver
  },
): T[] {
  const names = adapterNamespaceNames(adapterConfig, trackAssemblyNames)
  return regions.map(region => {
    const spelled = spellingAmong(names, region.assemblyName, name =>
      isSameAssemblyName(name, region.assemblyName, assemblyManager),
    )
    return spelled === region.assemblyName
      ? region
      : {
          ...(isStateTreeNode(region)
            ? getSnapshot(region as IStateTreeNode)
            : region),
          assemblyName: spelled,
        }
  })
}
