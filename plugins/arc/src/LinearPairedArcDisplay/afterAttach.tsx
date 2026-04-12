import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { fetchChains } from './fetchChains.ts'

import type { LinearArcDisplayModel } from './model.ts'

export function doAfterAttach(self: LinearArcDisplayModel) {
  addDisposer(
    self,
    autorun(async () => {
      try {
        await fetchChains(self)
      } catch (e) {
        if (isAlive(self)) {
          self.setError(e)
        }
      }
    }, { delay: 1000 }),
  )
}
