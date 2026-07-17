import { getSnapshot } from '@jbrowse/mobx-state-tree'

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
