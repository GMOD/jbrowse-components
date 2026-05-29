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
 * extends
 * - [LinearWiggleDisplay](../linearwiggledisplay)
 */
export default function SharedModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'SharedGCContentModel',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        /**
         * #property
         */
        windowSize: types.maybe(types.number),
        /**
         * #property
         */
        windowDelta: types.maybe(types.number),
        /**
         * #property
         */
        gcMode: types.maybe(types.enumeration('gcMode', ['content', 'skew'])),
      }),
    )
    .actions(self => ({
      setGCContentParams({
        windowSize,
        windowDelta,
      }: {
        windowSize: number
        windowDelta: number
      }) {
        self.windowSize = windowSize
        self.windowDelta = windowDelta
        self.reload()
      },
      setGCMode(mode: 'content' | 'skew') {
        self.gcMode = mode
        self.reload()
      },
    }))
    .views(self => ({
      get windowSizeSetting() {
        return self.windowSize ?? getConf(self, 'windowSize')
      },
      get windowDeltaSetting() {
        return self.windowDelta ?? getConf(self, 'windowDelta')
      },
      get gcModeSetting() {
        return self.gcMode ?? getConf(self, 'gcMode')
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
              checked: self.gcModeSetting === 'skew',
              onClick: () => {
                self.setGCMode(
                  self.gcModeSetting === 'skew' ? 'content' : 'skew',
                )
              },
            },
          ]
        },
        /**
         * #getter
         * retrieves the sequence adapter from parent track, and puts it as a
         * subadapter on a GCContentAdapter
         */
        get adapterConfig() {
          const sequenceAdapter = getConf(self.parentTrack, 'adapter')
          return {
            type: 'GCContentAdapter',
            sequenceAdapter,
            windowSize: self.windowSizeSetting,
            windowDelta: self.windowDeltaSetting,
            gcMode: self.gcModeSetting,
          }
        },
      }
    })
}
