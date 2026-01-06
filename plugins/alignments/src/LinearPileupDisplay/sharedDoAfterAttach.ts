import { getContainingView } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import { getUniqueTags } from '../shared/getUniqueTags.ts'
import { createAutorun } from '../util.ts'

import type { ColorBy } from '../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function sharedDoAfterAttach(self: {
  autorunReady: boolean
  adapterConfig: AnyConfigurationModel
  colorBy?: ColorBy
  tagsReady: boolean
  updateColorTagMap: (arg: string[]) => void
  setTagsReady: (arg: boolean) => void
}) {
  createAutorun(
    self,
    async () => {
      const view = getContainingView(self) as LGV
      if (!self.autorunReady) {
        return
      }

      const { colorBy, tagsReady } = self
      const { staticBlocks } = view
      if (colorBy?.tag && !tagsReady) {
        const vals = await getUniqueTags({
          self,
          tag: colorBy.tag,
          blocks: staticBlocks,
        })
        if (isAlive(self)) {
          self.updateColorTagMap(vals)
          self.setTagsReady(true)
        }
      } else {
        self.setTagsReady(true)
      }
    },
    { name: 'ColorReady', delay: 1000 },
  )
}
