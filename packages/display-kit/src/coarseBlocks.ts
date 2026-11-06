import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, reaction } from 'mobx'

import type { BlockSet } from '@jbrowse/core/util/blockTypes'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Whether two block lists cover the same blocks, in order. A block's key
 * encodes its assembly, refName, start and end, so keys are enough.
 */
export function sameBlockKeys(
  a: readonly { key: string }[],
  b: readonly { key: string }[],
) {
  return a.length === b.length && a.every((block, i) => block.key === b[i]!.key)
}

export interface CoarseBlocksHost extends IStateTreeNode {
  readonly initialized: boolean
  readonly dynamicBlocks: BlockSet
  readonly bpPerPx: number
  setCoarseDynamicBlocks(blocks: BlockSet, bpPerPx: number): void
}

/**
 * Keep a host's coarse blocks following its viewport 500ms behind, and land
 * them at once when the host initializes. A restored view is placed by its
 * snapshot rather than by an action, so without the second reaction its coarse
 * consumers read the placeholder (no blocks, 1 bp/px) for the first 500ms.
 */
export function installCoarseBlocks(self: CoarseBlocksHost, name: string) {
  function settle() {
    if (self.initialized) {
      self.setCoarseDynamicBlocks(self.dynamicBlocks, self.bpPerPx)
    }
  }
  addDisposer(
    self,
    reaction(() => self.initialized, settle, {
      fireImmediately: true,
      name: `${name}OnInit`,
    }),
  )
  addDisposer(self, autorun(settle, { delay: 500, name }))
}
