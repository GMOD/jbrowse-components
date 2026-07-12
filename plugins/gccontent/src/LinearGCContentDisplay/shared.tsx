import { getConf } from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

const WINDOW_SIZE_DEFAULT = 100
const WINDOW_DELTA_DEFAULT = 100
const formatBp = (n: number) => `${toLocale(n)} bp`

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
              label: 'GC parameters',
              type: 'subMenu',
              subMenu: [
                makeSizeMenu({
                  label: 'Window size',
                  title: 'Window',
                  scale: 'log',
                  min: 1,
                  max: 100_000,
                  format: formatBp,
                  commitOnRelease: true,
                  getValue: () => self.windowSize,
                  isDefault: self.windowSize === WINDOW_SIZE_DEFAULT,
                  onChange: windowSize => {
                    self.setGCContentParams({
                      windowSize,
                      windowDelta: self.windowDelta,
                    })
                  },
                  onReset: () => {
                    self.setGCContentParams({
                      windowSize: WINDOW_SIZE_DEFAULT,
                      windowDelta: self.windowDelta,
                    })
                  },
                }),
                makeSizeMenu({
                  label: 'Step size',
                  title: 'Step',
                  scale: 'log',
                  min: 1,
                  max: self.windowSize,
                  format: formatBp,
                  commitOnRelease: true,
                  getValue: () => self.windowDelta,
                  isDefault: self.windowDelta === WINDOW_DELTA_DEFAULT,
                  onChange: windowDelta => {
                    self.setGCContentParams({
                      windowSize: self.windowSize,
                      windowDelta,
                    })
                  },
                  onReset: () => {
                    self.setGCContentParams({
                      windowSize: self.windowSize,
                      windowDelta: WINDOW_DELTA_DEFAULT,
                    })
                  },
                }),
              ],
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
