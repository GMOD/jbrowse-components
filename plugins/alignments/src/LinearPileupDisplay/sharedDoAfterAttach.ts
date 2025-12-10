import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { getUniqueTags } from '../shared/getUniqueTags'
import { createAutorun } from '../util'

import type { ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function sharedDoAfterAttach(self: {
  autorunReady: boolean
  adapterConfig: AnyConfigurationModel
  effectiveRpcDriverName?: string
  colorBy: ColorBy
  tagsReady: boolean
  updateColorTagMap: (arg: string[]) => void
  setTagsReady: (arg: boolean) => void
  featureIdUnderMouse?: string
  featureUnderMouse?: Feature
  setFeatureUnderMouse: (arg?: Feature) => void
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

  // autorun synchronizes featureUnderMouse with featureIdUnderMouse
  // asynchronously. this is needed due to how we do not serialize all
  // features from the BAM/CRAM over the rpc
  addDisposer(
    self,
    autorun(
      async () => {
        const session = getSession(self)
        try {
          const featureId = self.featureIdUnderMouse
          if (self.featureUnderMouse?.id() !== featureId) {
            if (!featureId) {
              self.setFeatureUnderMouse(undefined)
            } else {
              const sessionId = getRpcSessionId(self)
              const { feature } = (await session.rpcManager.call(
                sessionId,
                'CoreGetFeatureDetails',
                {
                  featureId,
                  sessionId,
                  layoutId: getContainingTrack(self).id,
                  rendererType: 'PileupRenderer',
                  rpcDriverName: self.effectiveRpcDriverName,
                },
              )) as { feature: SimpleFeatureSerialized | undefined }

              // check featureIdUnderMouse is still the same
              // as the feature.id that was returned e.g. that
              // the user hasn't moused over to a new position
              // during the async operation above
              if (
                isAlive(self) &&
                feature &&
                self.featureIdUnderMouse === feature.uniqueId
              ) {
                self.setFeatureUnderMouse(new SimpleFeature(feature))
              }
            }
          }
        } catch (e) {
          console.error(e)
          session.notifyError(`${e}`, e)
        }
      },
      { name: 'FeatureUnderMouse' },
    ),
  )
}
