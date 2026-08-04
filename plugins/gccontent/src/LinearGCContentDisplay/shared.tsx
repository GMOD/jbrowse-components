import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import { linearWiggleDisplayModelFactory } from '@jbrowse/plugin-wiggle'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { LinearGCContentDisplayConfigSchema } from './index.ts'

const WINDOW_SIZE_DEFAULT = 100
const WINDOW_DELTA_DEFAULT = 100
const formatBp = (n: number) => `${toLocale(n)} bp`

/**
 * #stateModel SharedGCContentModel
 * #category display
 */
export default function SharedModelF(
  pluginManager: PluginManager,
  configSchema: LinearGCContentDisplayConfigSchema,
) {
  return types
    .compose(
      'SharedGCContentModel',
      linearWiggleDisplayModelFactory(pluginManager, configSchema),
      // Redeclaring `configuration` is what lets the GC slots below be read as
      // this schema's own. The wiggle base declares the same prop against the
      // *wiggle* schema, and `types.compose` overrides props rather than
      // intersecting them, so without this every `getConf(self, 'windowSize')`
      // here is checked against the base's slot list and fails. Costs nothing
      // at runtime — same node either way.
      types.model({
        configuration: ConfigurationReference(configSchema),
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
        setConf(self, 'windowSize', windowSize)
        setConf(self, 'windowDelta', windowDelta)
      },
      setGCMode(mode: 'content' | 'skew') {
        setConf(self, 'gcMode', mode)
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
      const { rpcProps: superRpcProps } = self
      return {
        /**
         * #method
         * The three GC parameters are fetch inputs: both subclasses fold them
         * into the `GCContentAdapter` config their `adapterConfig` getter
         * builds, so each changes what the worker computes. `adapterConfig` is a
         * structural arg and deliberately not a cache key, so listing them here
         * is the only thing that invalidates the loaded regions. They ride along
         * in the payload too; the worker ignores them and reads the adapter.
         *
         * They used to live outside `rpcProps()`, with each setter calling
         * `reload()` by hand — which covered the track menu and nothing else.
         */
        rpcProps() {
          return {
            ...superRpcProps(),
            windowSize: self.windowSize,
            windowDelta: self.windowDelta,
            gcMode: self.gcMode,
          }
        },
      }
    })
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
