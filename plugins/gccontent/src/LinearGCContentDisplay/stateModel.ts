import {
  getConf,
  AnyConfigurationSchemaType,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { types } from 'mobx-state-tree'
import { lazy } from 'react'

const EditGCContentParamsDlg = lazy(
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
        windowSize: types.maybe(types.number),
        /**
         * #property
         */
        windowDelta: types.maybe(types.number),
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
      get windowSizeSetting() {
        return self.windowSize ?? getConf(self, 'windowSize')
      },
      get windowDeltaSetting() {
        return self.windowDelta ?? getConf(self, 'windowDelta')
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self
      return {
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Change GC parameters',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  EditGCContentParamsDlg,
                  { model: self, handleClose },
                ])
              },
            },
          ]
        },
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
              type: 'GCContentAdapter',
              sequenceAdapter,
              windowSize: self.windowSizeSetting,
              windowDelta: self.windowDeltaSetting,
            },
          }
        },
      }
    })
}
