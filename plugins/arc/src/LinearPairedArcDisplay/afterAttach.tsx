import { fetchChains } from './fetchChains.ts'
import { createAutorun } from './util.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export function doAfterAttach<T extends IAnyStateTreeNode>(self: T) {
  createAutorun(
    self,
    async () => {
      await fetchChains(self)
    },
    { delay: 1000 },
  )
}
