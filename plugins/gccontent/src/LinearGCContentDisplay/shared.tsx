import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

import GCContentParamsSliders from './components/GCContentParamsSliders.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

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
                {
                  label: 'GC parameter sliders',
                  type: 'custom',
                  render: () => <GCContentParamsSliders model={self} />,
                },
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
