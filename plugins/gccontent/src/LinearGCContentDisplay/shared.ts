import { lazy } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'
import { types } from 'mobx-state-tree'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

const EditGCContentParamsDialog = lazy(
  () => import('./components/EditGCContentParams'),
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
        adapterProps: superAdapterProps,
      } = self
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
          ]
        },
        /**
         * #method
         * retrieves the sequence adapter from parent track, and puts it as a
         * subadapter on a GCContentAdapter
         */
        adapterProps() {
          const sequenceAdapter = getConf(self.parentTrack, 'adapter')
          return {
            ...superAdapterProps(),
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
