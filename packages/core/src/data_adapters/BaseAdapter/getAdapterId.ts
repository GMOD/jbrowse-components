import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { fingerprintAdapterConfig } from '../adapterConfigFingerprint.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'

/**
 * @deprecated the hash behind the deprecated `BaseAdapter.id`
 */
export function getAdapterId(config: AnyConfigurationModel) {
  const data = isStateTreeNode(config) ? getSnapshot(config) : config
  return fingerprintAdapterConfig(data).key
}
