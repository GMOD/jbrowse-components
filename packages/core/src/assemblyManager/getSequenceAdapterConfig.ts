import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '../configuration/index.ts'
import type { Assembly } from './assembly.ts'

/**
 * The assembly's reference-sequence adapter config as a plain snapshot, or
 * undefined if the assembly (or its config) isn't available. Snapshotted
 * because MST nodes can't be assigned into another tree or sent over RPC.
 * configuration is a safeReference, so it's either a live node (getSnapshot is
 * safe) or undefined (?. handles it).
 */
export function getSequenceAdapterConfig(
  assembly?: Pick<Assembly, 'configuration'>,
): Record<string, unknown> | undefined {
  const adapter = assembly?.configuration?.sequence?.adapter
  return adapter ? getSnapshot(adapter) : undefined
}

/**
 * {@link getSequenceAdapterConfig} for a name, canonical or alias. The built
 * model first, then the config it will be built from, so this answers before
 * the model exists. Neither lookup reports an unknown name the way
 * `assemblyManager.get` does, and a track config may name an assembly the
 * session lacks.
 */
export function getSequenceAdapterConfigByName(
  assemblyManager: {
    assemblyNameMap: Record<string, Pick<Assembly, 'configuration'>>
    confByName: Map<string, AnyConfigurationModel>
  },
  assemblyName: string,
): Record<string, unknown> | undefined {
  const adapter = (
    assemblyManager.assemblyNameMap[assemblyName]?.configuration ??
    assemblyManager.confByName.get(assemblyName)
  )?.sequence?.adapter
  return adapter ? getSnapshot(adapter) : undefined
}
