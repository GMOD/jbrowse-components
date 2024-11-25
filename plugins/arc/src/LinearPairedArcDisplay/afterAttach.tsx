import { fetchChains } from './fetchChains'
import { createAutorun } from './util'
import type { IAnyStateTreeNode } from 'mobx-state-tree'

export function doAfterAttach<T extends IAnyStateTreeNode>(self: T) {
  createAutorun(
    self,
    async () => {
      await fetchChains(self)
    },
    { delay: 1000 },
  )
}
