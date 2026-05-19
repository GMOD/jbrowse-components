import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import idMaker from '../../util/idMaker.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'

// extracted into its own module so tests can swap it out via jest's
// moduleNameMapper for a stable 'test' id, keeping the test detection out
// of the production class
export function getAdapterId(config: AnyConfigurationModel) {
  const data = isStateTreeNode(config) ? getSnapshot(config) : config
  return idMaker(data)
}
