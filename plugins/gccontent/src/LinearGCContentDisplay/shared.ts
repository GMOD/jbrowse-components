import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

import { migrateGCContentSnapshot } from './migration.ts'

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
      types.model({
        /**
         * #property
         * explicit override; the `windowSize` getter resolves it over the
         * config `windowSize` slot
         */
        windowSizeOverride: types.maybe(types.number),
        /**
         * #property
         * explicit override; resolved by the `windowDelta` getter
         */
        windowDeltaOverride: types.maybe(types.number),
        /**
         * #property
         * explicit override; resolved by the `gcMode` getter
         */
        gcModeOverride: types.maybe(
          types.enumeration('gcMode', ['content', 'skew']),
        ),
      }),
    )
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
      migrateGCContentSnapshot(snap),
    )
    .actions(self => ({
      setGCContentParams({
        windowSize,
        windowDelta,
      }: {
        windowSize: number
        windowDelta: number
      }) {
        self.windowSizeOverride = windowSize
        self.windowDeltaOverride = windowDelta
        self.reload()
      },
      setGCMode(mode: 'content' | 'skew') {
        self.gcModeOverride = mode
        self.reload()
      },
    }))
    .views(self => ({
      get windowSize() {
        return self.windowSizeOverride ?? getConf(self, 'windowSize')
      },
      get windowDelta() {
        return self.windowDeltaOverride ?? getConf(self, 'windowDelta')
      },
      get gcMode() {
        return self.gcModeOverride ?? getConf(self, 'gcMode')
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
