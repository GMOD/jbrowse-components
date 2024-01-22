import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'
import deepEqual from 'fast-deep-equal'

export function getLowerPanelDisplays(pluginManager: PluginManager) {
  return (
    pluginManager
      .getDisplayElements()
      // @ts-expect-error
      .filter(f => f.subDisplay?.type === 'LinearAlignmentsDisplay')
      // @ts-expect-error
      .filter(f => f.subDisplay?.lowerPanel)
  )
}

function snapOrObj(r: unknown) {
  return isStateTreeNode(r) ? getSnapshot(r) : r
}

function snap(r: unknown) {
  return r ? snapOrObj(r) : undefined
}

export function deepSnap(x1: unknown, x2: unknown) {
  return deepEqual(snap(x1), snap(x2))
}
