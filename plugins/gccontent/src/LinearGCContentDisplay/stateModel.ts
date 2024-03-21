import {
  getConf,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { types } from 'mobx-state-tree'
import { lazy } from 'react'

const EditGCContentParamsDialog = lazy(
  () => import('./components/EditGCContentParams'),
)

/**
 * #stateModel LinearGCContentDisplay
 * #category display
 * base model `BaseWiggleDisplayModel`
 */
export default function stateModelFactory(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearGCContentDisplay',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearGCContentDisplay'),

        /**
         * #property
         */
        windowDelta: types.maybe(types.number),

        /**
         * #property
         */
        windowSize: types.maybe(types.number),
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
      },
    }))
    .views(self => ({
      get windowDeltaSetting() {
        return self.windowDelta ?? getConf(self, 'windowDelta')
      },
      get windowSizeSetting() {
        return self.windowSize ?? getConf(self, 'windowSize')
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self
      return {
        /**
         * #method
         * retrieves the sequence adapter from parent track, and puts it as a
         * subadapter on a GCContentAdapter
         */
        renderProps() {
          const sequenceAdapter = getConf(self.parentTrack, 'adapter')
          return {
            ...superRenderProps(),
            adapterConfig: {
              sequenceAdapter,
              type: 'GCContentAdapter',
              windowDelta: self.windowDeltaSetting,
              windowSize: self.windowSizeSetting,
            },
          }
        },

        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Change GC parameters',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  EditGCContentParamsDialog,
                  { handleClose, model: self },
                ])
              },
            },
          ]
        },
      }
    })
}
