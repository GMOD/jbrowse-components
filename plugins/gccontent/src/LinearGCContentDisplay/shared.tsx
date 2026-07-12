import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

const EditGCContentParamsDialog = lazy(
  () => import('./components/EditGCContentParams.tsx'),
)

/**
 * #stateModel SharedGCContentModel
 * #category display
 */
export default function SharedModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'SharedGCContentModel',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({}),
    )
    .actions(self => ({
      setGCContentParams({
        windowSize,
        windowDelta,
      }: {
        windowSize: number
        windowDelta: number
      }) {
        self.configuration.setSlot('windowSize', windowSize)
        self.configuration.setSlot('windowDelta', windowDelta)
        self.reload()
      },
      setGCMode(mode: 'content' | 'skew') {
        self.configuration.setSlot('gcMode', mode)
        self.reload()
      },
    }))
    .views(self => ({
      get windowSize() {
        return getConf(self, 'windowSize')
      },
      get windowDelta() {
        return getConf(self, 'windowDelta')
      },
      get gcMode() {
        return getConf(self, 'gcMode')
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Change GC parameters',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  EditGCContentParamsDialog,
                  { model: self, handleClose },
                ])
              },
            },
            {
              label: 'GC skew',
              type: 'checkbox',
              checked: self.gcMode === 'skew',
              onClick: () => {
                self.setGCMode(self.gcMode === 'skew' ? 'content' : 'skew')
              },
            },
          ]
        },
      }
    })
}
