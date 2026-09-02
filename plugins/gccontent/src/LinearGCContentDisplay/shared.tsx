import {
  ConfigurationReference,
  getConf,
  setConf,
} from '@jbrowse/core/configuration'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
// the subpath, not the barrel: the barrel is eager, and a value edge from it
// into the wiggle display model would undo that display's lazy loading. This
// module is itself only reached through the GC displays' own loaders.
import linearWiggleDisplayModelFactory from '@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel'

import type { LinearGCContentDisplayConfigSchema } from './index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

const WINDOW_SIZE_DEFAULT = 100
const WINDOW_DELTA_DEFAULT = 100
const formatBp = (n: number) => `${toLocale(n)} bp`

/**
 * The `GCContentAdapter` config a GC display fetches through: the track's
 * adapter when it already is one, otherwise a sequence adapter wrapped in one,
 * with the display's three GC parameters applied either way.
 *
 * Both display types build theirs here. The canonical `GCContentTrack` names a
 * `GCContentAdapter` (see `LinearGCContentTrackDisplay`), the
 * `ReferenceSequenceTrack` display always has a bare sequence adapter, and a
 * `GCContentTrack` can name a bare one too: that was the only shape that worked
 * before the display stopped wrapping unconditionally, and it shipped in our
 * own volvox configs long enough to be out in the wild. Left unwrapped, the
 * sequence adapter's featureless output reaches the wiggle as an empty domain
 * and the track draws an axis with no data, silently and with no error.
 */
export function gcAdapterConfig(
  self: { windowSize: number; windowDelta: number; gcMode: string },
  adapter: { type: string },
) {
  return {
    ...(adapter.type === 'GCContentAdapter'
      ? adapter
      : { type: 'GCContentAdapter', sequenceAdapter: adapter }),
    windowSize: self.windowSize,
    windowDelta: self.windowDelta,
    gcMode: self.gcMode,
  }
}

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
    .views(self => ({
      get windowSize(): number {
        return getConf(self, 'windowSize')
      },
      get windowDelta(): number {
        return getConf(self, 'windowDelta')
      },
      get gcMode(): 'content' | 'skew' {
        return getConf(self, 'gcMode')
      },
      /**
       * #getter
       * Overrides the wiggle base's strict-zoom key: the adapter computes GC
       * from `windowSize`/`windowDelta`/`gcMode` alone and the worker does no
       * per-zoom binning, so data fetched at one zoom is right at every other.
       */
      get zoomFetchKey(): string {
        return ''
      },
      /**
       * #getter
       * The parent track's adapter with the display's GC parameters applied,
       * wrapped in a `GCContentAdapter` where the track names a bare sequence
       * adapter — see `gcAdapterConfig`.
       */
      get adapterConfig() {
        return gcAdapterConfig(this, getConf(self.parentTrack, 'adapter'))
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Either parameter alone; the other keeps its current value. Both menus
       * change one of the two, and spelling that as "write both, carrying the
       * other across" put `windowDelta: self.windowDelta` in four call sites —
       * which is also where the clamp below would have had to be repeated.
       */
      setGCContentParams({
        windowSize = self.windowSize,
        windowDelta = self.windowDelta,
      }: {
        windowSize?: number
        windowDelta?: number
      }) {
        setConf(self, 'windowSize', windowSize)
        // A step wider than the window it steps leaves gaps the scores say
        // nothing about, which is why the step menu caps itself at windowSize.
        // The cap alone isn't the invariant though: *shrinking* windowSize
        // through its own menu left the larger windowDelta behind, so each
        // painted bin was scored from a window covering a fraction of it.
        setConf(self, 'windowDelta', Math.min(windowDelta, windowSize))
      },
      setGCMode(mode: 'content' | 'skew') {
        setConf(self, 'gcMode', mode)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Overrides ScoreScaleMixin's autoscale-both-ends default. GC content is
       * a fraction of the bases in a window, so [0,1] is the quantity's own
       * range and pins the axis across loci.
       *
       * Skew is deliberately left autoscaling. Its range is [-1,1] and fixing
       * it there would be just as *correct*, and useless: real skew sits within
       * roughly ±0.3, so a [-1,1] axis squashes the sign flip at the
       * replication origin — the entire thing the track is read for — into a
       * flat line. Bounded and worth pinning are two different properties.
       */
      get defaultScoreDomain(): [number | undefined, number | undefined] {
        return self.gcMode === 'content' ? [0, 1] : [undefined, undefined]
      },
    }))
    .views(self => {
      const { rpcProps: superRpcProps } = self
      return {
        /**
         * #method
         * The three GC parameters are fetch inputs: `adapterConfig` folds them
         * into the `GCContentAdapter` config, so each changes what the worker
         * computes. `adapterConfig` is a
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
                    self.setGCContentParams({ windowSize })
                  },
                  onReset: () => {
                    self.setGCContentParams({ windowSize: WINDOW_SIZE_DEFAULT })
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
                    self.setGCContentParams({ windowDelta })
                  },
                  onReset: () => {
                    self.setGCContentParams({
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
