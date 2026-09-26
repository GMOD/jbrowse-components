import { readConfObject, setConf } from '@jbrowse/core/configuration'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
// the same four columns QuantitativeTrack downloads, and this track renders the
// wiggle body anyway — a second copy of the writer was one place for the
// score-missing fallback to drift
import { bedGraphFormatOptions } from '@jbrowse/plugin-wiggle'

import configSchemaF from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

const WINDOW_SIZE_DEFAULT = 100
const WINDOW_DELTA_DEFAULT = 100
const formatBp = (n: number) => `${toLocale(n)} bp`

export default function GCContentTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'GCContentTrack',
      displayName: 'GCContent track',
      configSchema,
      stateModel: createBaseTrackModel(pm, 'GCContentTrack', configSchema)
        .views(self => ({
          saveTrackFileFormatOptions() {
            return bedGraphFormatOptions
          },
          /**
           * #getter
           * The `GCContentAdapter` computing the signal, which holds the
           * window, the step and the mode.
           */
          get gcAdapter(): AnyConfigurationModel {
            return self.configuration.adapter
          },
          /**
           * #getter
           */
          get windowSize(): number {
            return readConfObject(this.gcAdapter, 'windowSize')
          },
          /**
           * #getter
           */
          get windowDelta(): number {
            return readConfObject(this.gcAdapter, 'windowDelta')
          },
          /**
           * #getter
           */
          get gcMode(): 'content' | 'skew' {
            return readConfObject(this.gcAdapter, 'gcMode')
          },
        }))
        .actions(self => ({
          /**
           * #action
           * Either parameter alone; the other keeps its value. A step wider
           * than its window leaves gaps the scores say nothing about, so the
           * step never passes the window, shrinking with it.
           */
          setGCContentParams({
            windowSize = self.windowSize,
            windowDelta = self.windowDelta,
          }: {
            windowSize?: number
            windowDelta?: number
          }) {
            setConf(self.gcAdapter, 'windowSize', windowSize)
            setConf(
              self.gcAdapter,
              'windowDelta',
              Math.min(windowDelta, windowSize),
            )
          },
          /**
           * #action
           */
          setGCMode(mode: 'content' | 'skew') {
            setConf(self.gcAdapter, 'gcMode', mode)
          },
        }))
        .views(self => {
          const { trackMenuItems: superTrackMenuItems } = self
          return {
            trackMenuItems(): MenuItem[] {
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
                        self.setGCContentParams({
                          windowSize: WINDOW_SIZE_DEFAULT,
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
        }),
    })
  })
}
