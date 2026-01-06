import { getContainingView } from '@jbrowse/core/util'
import { isAlive } from '@jbrowse/mobx-state-tree'

import {
  buildFlatbushIndex,
  buildMismatchFlatbushIndex,
} from '../RenderLinearReadCloudDisplayRPC/drawFeatsCommon.ts'
import {
  createRPCRenderFunction,
  setupCanvasRenderingAutorun,
} from '../shared/createRPCRenderingSetup.ts'
import { setupModificationsAutorun } from '../shared/setupModificationsAutorun.ts'
import { createAutorun } from '../util.ts'

import type { LinearReadCloudDisplayModel } from './model.ts'
import type { FlatbushItem } from '../PileupRenderer/types.ts'
import type { FlatbushEntry } from '../shared/flatbushType.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface CloudRenderResult {
  layoutHeight?: number
  cloudMaxDistance?: number
  featuresForFlatbush?: FlatbushEntry[]
  mismatchFlatbush?: ArrayBuffer
  mismatchItems?: FlatbushItem[]
}

export function doAfterAttachRPC(self: LinearReadCloudDisplayModel) {
  const createCloudRender = (drawCloud: boolean) =>
    createRPCRenderFunction({
      self,
      rpcMethodName: 'RenderLinearReadCloudDisplay',
      getRPCParams: () => ({
        ...self.renderProps(),
        drawCloud,
        ...(drawCloud && { cloudModeHeight: self.height }),
      }),
      onResult: (result: CloudRenderResult) => {
        if (!drawCloud && result.layoutHeight !== undefined) {
          self.setLayoutHeight(result.layoutHeight)
        }
        if (drawCloud && result.cloudMaxDistance !== undefined) {
          self.setCloudMaxDistance(result.cloudMaxDistance)
        }
        if (result.featuresForFlatbush) {
          buildFlatbushIndex(result.featuresForFlatbush, self)
        }
        if (result.mismatchFlatbush && result.mismatchItems) {
          buildMismatchFlatbushIndex(
            result.mismatchFlatbush,
            result.mismatchItems,
            self,
          )
        }
      },
    })

  const performCloudRender = createCloudRender(true)
  const performStackRender = createCloudRender(false)

  createAutorun(
    self,
    async () => {
      if (!self.drawCloud || !isAlive(self)) {
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performCloudRender()
    },
    {
      delay: 1000,
      name: 'CloudRender',
    },
  )

  createAutorun(
    self,
    async () => {
      if (self.drawCloud || !isAlive(self)) {
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performStackRender()
    },
    {
      delay: 1000,
      name: 'StackRender',
    },
  )

  setupCanvasRenderingAutorun(self)

  setupModificationsAutorun(self, () => {
    const view = getContainingView(self) as LGV
    return view.initialized && self.featureDensityStatsReadyAndRegionNotTooLarge
  })
}
