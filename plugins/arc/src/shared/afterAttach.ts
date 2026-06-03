import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { fetchArcFeatures } from './fetchArcFeatures.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

export function doAfterAttach(self: ArcDisplayModel) {
  addDisposer(
    self,
    autorun(
      async () => {
        try {
          await fetchArcFeatures(self)
        } catch (e) {
          if (isAlive(self)) {
            self.setError(e)
          }
        }
      },
      { delay: 1000 },
    ),
  )
}
