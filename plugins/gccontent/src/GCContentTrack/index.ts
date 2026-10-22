import { readConfObject, setConf } from '@jbrowse/core/configuration'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import { createBaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import { makeSizeMenu } from '@jbrowse/core/ui'
import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
// the same four columns QuantitativeTrack downloads, and this track renders the
// wiggle body anyway — a second copy of the writer was one place for the
// score-missing fallback to drift
import { bedGraphFormatOptions } from '@jbrowse/plugin-wiggle'
import FunctionsIcon from '@mui/icons-material/Functions'

import { AUTO_STEP, WINDOW_DEFAULT } from '../GCContentAdapter/gcWindow.ts'
import configSchemaF from './configSchema.ts'

import type { GCContentAdapterConfig } from '../GCContentAdapter/configSchema.ts'
import type { GCStep } from '../GCContentAdapter/gcWindow.ts'
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
           * The `GCContentAdapter` computing the signal, which holds the op,
           * the window and the step.
           */
          get gcAdapter(): GCContentAdapterConfig {
            return self.configuration.adapter
          },
          /**
           * #getter
           */
          get op(): 'content' | 'skew' {
            return readConfObject(this.gcAdapter, 'op')
          },
          /**
           * #getter
           * The window as configured, before a wider step widens it.
           */
          get window(): number {
            return readConfObject(this.gcAdapter, 'window')
          },
          /**
           * #getter
           */
          get step(): GCStep {
            return readConfObject(this.gcAdapter, 'step')
          },
        }))
        .actions(self => ({
          /**
           * #action
           */
          setOp(op: 'content' | 'skew') {
            setConf(self.gcAdapter, 'op', op)
          },
          /**
           * #action
           */
          setWindow(window: number) {
            setConf(self.gcAdapter, 'window', window)
          },
          /**
           * #action
           */
          setStep(step: GCStep) {
            setConf(self.gcAdapter, 'step', step)
          },
        }))
        .views(self => {
          const { trackMenuItems: superTrackMenuItems } = self
          return {
            trackMenuItems(): MenuItem[] {
              const { step } = self
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
                      self.op,
                      op => {
                        self.setOp(op)
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
                      getValue: () => self.window,
                      isDefault: self.window === WINDOW_DEFAULT,
                      onChange: window => {
                        self.setWindow(window)
                      },
                      onReset: () => {
                        self.setWindow(WINDOW_DEFAULT)
                      },
                    }),
                    toggleItem(
                      'Step follows zoom',
                      step === AUTO_STEP,
                      follows => {
                        self.setStep(follows ? AUTO_STEP : self.window)
                      },
                      {
                        helpText:
                          'One score per pixel, on a 1, 2, 5, 10 bp ladder; a window narrower than the step widens to it',
                      },
                    ),
                    ...(step === AUTO_STEP
                      ? []
                      : [
                          makeSizeMenu({
                            label: 'Step size',
                            title: 'Step',
                            scale: 'log',
                            min: 1,
                            max: 100_000,
                            format: formatBp,
                            commitOnRelease: true,
                            getValue: () =>
                              typeof self.step === 'number'
                                ? self.step
                                : self.window,
                            isDefault: false,
                            onChange: step => {
                              self.setStep(step)
                            },
                            onReset: () => {
                              self.setStep(AUTO_STEP)
                            },
                          }),
                        ]),
                  ],
                },
              ]
            },
          }
        }),
    })
  })
}
