import { readConfObject, setConf } from '@jbrowse/core/configuration'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { radioItems } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
// the same four columns QuantitativeTrack downloads, and this track renders the
// wiggle body anyway — a second copy of the writer was one place for the
// score-missing fallback to drift
import { bedGraphFormatOptions } from '@jbrowse/plugin-wiggle'
import FunctionsIcon from '@mui/icons-material/Functions'

import {
  WINDOW_SIZE_DEFAULT,
  resolveGCWindow,
} from '../GCContentAdapter/gcWindow.ts'
import configSchemaF from './configSchema.ts'

import type { GCContentAdapterConfig } from '../GCContentAdapter/configSchema.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'

const formatBp = (n: number) => `${toLocale(n)} bp`

export default function GCContentTrackF(pm: PluginManager) {
  pm.addTrackType(() => {
    const configSchema = configSchemaF(pm)
    return new TrackType({
      name: 'GCContentTrack',
      displayName: 'GC content track',
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
          get gcAdapter(): GCContentAdapterConfig {
            return self.configuration.adapter
          },
          /**
           * #getter
           * The window and step the adapter scores with, resolved.
           */
          get gcWindow() {
            return resolveGCWindow(
              readConfObject(this.gcAdapter, 'windowSize'),
              readConfObject(this.gcAdapter, 'windowDelta'),
            )
          },
          /**
           * #getter
           */
          get windowSize() {
            return this.gcWindow.windowSize
          },
          /**
           * #getter
           */
          get windowDelta() {
            return this.gcWindow.windowDelta
          },
          /**
           * #getter
           * Whether the step is unset, tiling the windows.
           */
          get stepTilesWindow() {
            return readConfObject(this.gcAdapter, 'windowDelta') === undefined
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
           * Either parameter alone; the other keeps its value. A step at or
           * past the window is written unset, so the windows tile and the
           * step grows with the window again.
           */
          setGCContentParams({
            windowSize = self.windowSize,
            windowDelta = self.stepTilesWindow ? undefined : self.windowDelta,
          }: {
            windowSize?: number
            windowDelta?: number
          }) {
            setConf(self.gcAdapter, 'windowSize', windowSize)
            setConf(
              self.gcAdapter,
              'windowDelta',
              windowDelta === undefined || windowDelta >= windowSize
                ? undefined
                : windowDelta,
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
                  icon: FunctionsIcon,
                  type: 'subMenu',
                  subMenu: [
                    ...radioItems(
                      [
                        { value: 'content', label: 'GC content' },
                        { value: 'skew', label: 'GC skew' },
                      ],
                      self.gcMode,
                      mode => {
                        self.setGCMode(mode)
                      },
                    ),
                    { type: 'divider' },
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
                      isDefault: self.stepTilesWindow,
                      onChange: windowDelta => {
                        self.setGCContentParams({ windowDelta })
                      },
                      onReset: () => {
                        self.setGCContentParams({
                          windowDelta: self.windowSize,
                        })
                      },
                    }),
                  ],
                },
              ]
            },
          }
        }),
    })
  })
}
