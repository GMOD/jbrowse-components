import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { assemblyConfByName } from './assemblyConfByName.ts'

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
 * {@link getSequenceAdapterConfig} read off the config answering to
 * `assemblyName`, so it answers before the assembly's model is built or its
 * regions have loaded.
 */
export function getSequenceAdapterConfigByName(
  assemblyManager: { assemblyList: AnyConfigurationModel[] },
  assemblyName: string,
): Record<string, unknown> | undefined {
  const adapter = assemblyConfByName(assemblyManager, assemblyName)?.sequence
    ?.adapter
  return adapter ? getSnapshot(adapter) : undefined
}
