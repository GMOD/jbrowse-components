import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getEnv,
  getSession,
  measureText,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { addDisposer, isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import PaletteIcon from '@mui/icons-material/Palette'
import { autorun, untracked } from 'mobx'

import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { migrateWiggleSnapshot } from '../shared/migrateWiggleSnapshot.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  computeAutoscaleDomain,
  getNiceDomain,
  getScale,
  isDefaultBicolor,
} from '../util.ts'

import type { WiggleDataResult } from '../RenderWiggleDataRPC/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
  MultiRegionRegionWithNumber as RegionWithNumber,
} from '@jbrowse/plugin-linear-genome-view'

export type { MultiRegionRegion as Region } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const WiggleComponent = lazy(() => import('./components/WiggleComponent.tsx'))
const SetMinMaxDialog = lazy(() => import('../shared/SetMinMaxDialog.tsx'))
const SetColorDialog = lazy(() => import('./components/SetColorDialog.tsx'))

export default function stateModelFactory(
  _pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearWiggleDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      ConfigOverrideMixin(),
      types.model({
        type: types.literal('LinearWiggleDisplay'),
        configuration: ConfigurationReference(configSchema),
        resolution: types.optional(types.number, 1),
        displayCrossHatches: types.optional(types.boolean, false),
      }),
    )
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }

      // Strip properties from old BaseLinearDisplay snapshots
      const { blockState, showLegend, showTooltips, ...cleaned } = snap
      snap = cleaned

      // Rewrite "height" from older snapshots to "heightPreConfig"
      if (snap.height !== undefined && snap.heightPreConfig === undefined) {
        const { height, ...rest } = snap
        snap = { ...rest, heightPreConfig: height }
      }

      return migrateWiggleSnapshot(snap)
    })
    .volatile(() => ({
      rpcDataMap: new Map<number, WiggleDataResult>(),
      visibleScoreRange: undefined as [number, number] | undefined,
      loadedBpPerPx: new Map<number, number>(),
      featureUnderMouse: undefined as
        | {
            refName: string
            start: number
            end: number
            score: number
            minScore?: number
            maxScore?: number
            summary?: boolean
          }
        | undefined,
    }))
    .views(self => ({
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as { trackLabelsSetting?: string }
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },

      get DisplayMessageComponent() {
        return WiggleComponent
      },

      renderProps() {
        return { notReady: true }
      },

      get color() {
        return self.getConfWithOverride<string>('color')
      },

      get posColor() {
        return self.getConfWithOverride<string>('posColor')
      },

      get negColor() {
        return self.getConfWithOverride<string>('negColor')
      },

      get bicolorPivot() {
        return self.getConfWithOverride<number>('bicolorPivot')
      },

      get effectiveBicolorPivot() {
        return isDefaultBicolor(this.color) ? this.bicolorPivot : -Infinity
      },

      get scaleType() {
        return self.getConfWithOverride<string>('scaleType')
      },

      get autoscaleType() {
        return self.getConfWithOverride<string>('autoscale')
      },

      get hasResolution() {
        const track = getContainingTrack(self)
        const adapterConfig = getConf(track, 'adapter') as { type: string }
        const { pluginManager } = getEnv(self)
        return (
          pluginManager
            .getAdapterType(adapterConfig.type)
            ?.adapterCapabilities.includes('hasResolution') ?? false
        )
      },

      adapterProps() {
        const track = getContainingTrack(self)
        return {
          adapterConfig: getConf(track, 'adapter'),
        }
      },

      get summaryScoreMode() {
        return self.getConfWithOverride<string>('summaryScoreMode')
      },

      get renderingType() {
        return self.getConfWithOverride<string>('defaultRendering')
      },

      get isDensityMode() {
        return this.renderingType === 'density'
      },

      get minScore() {
        return self.getConfWithOverride<number>('minScore')
      },

      get maxScore() {
        return self.getConfWithOverride<number>('maxScore')
      },

      get minScoreConfig() {
        const val = this.minScore
        return val === Number.MIN_VALUE ? undefined : val
      },

      get maxScoreConfig() {
        const val = this.maxScore
        return val === Number.MAX_VALUE ? undefined : val
      },

      get domain(): [number, number] | undefined {
        if (self.rpcDataMap.size === 0) {
          return undefined
        }
        const range = self.visibleScoreRange
        if (!range) {
          return undefined
        }
        return getNiceDomain({
          domain: range,
          bounds: [this.minScoreConfig, this.maxScoreConfig],
          scaleType: this.scaleType,
        })
      },

      get ticks() {
        const scaleType = this.scaleType
        const { height } = self
        const domain = this.domain
        if (!domain) {
          return undefined
        }
        const minimalTicks = self.getConfWithOverride<boolean>('minimalTicks')
        const ticks = axisPropsFromTickScale(
          getScale({
            scaleType,
            domain,
            range: [height - YSCALEBAR_LABEL_OFFSET, YSCALEBAR_LABEL_OFFSET],
            inverted: false,
          }),
          4,
        )
        return height < 100 || minimalTicks
          ? { ...ticks, values: domain }
          : ticks
      },
    }))
    .actions(self => ({
      setRpcDataForRegion(regionNumber: number, data: WiggleDataResult) {
        const next = new Map(self.rpcDataMap)
        next.set(regionNumber, data)
        self.rpcDataMap = next
      },

      setVisibleScoreRange(range: [number, number]) {
        self.visibleScoreRange = range
      },

      setLoadedBpPerPxForRegion(regionNumber: number, bpPerPx: number) {
        const next = new Map(self.loadedBpPerPx)
        next.set(regionNumber, bpPerPx)
        self.loadedBpPerPx = next
      },

      clearDisplaySpecificData() {
        self.rpcDataMap = new Map()
        self.visibleScoreRange = undefined
        self.loadedBpPerPx = new Map()
      },

      reload() {
        self.setError(null)
        self.clearAllRpcData()
      },

      setColor(color?: string) {
        self.setOverride('color', color)
      },

      setPosColor(color?: string) {
        self.setOverride('posColor', color)
      },

      setNegColor(color?: string) {
        self.setOverride('negColor', color)
      },

      setScaleType(scaleType: string) {
        self.setOverride('scaleType', scaleType)
      },

      setMinScore(val?: number) {
        self.setOverride('minScore', val)
      },

      setMaxScore(val?: number) {
        self.setOverride('maxScore', val)
      },

      setRenderingType(type: string) {
        self.setOverride('defaultRendering', type)
      },

      setSummaryScoreMode(val: string) {
        self.setOverride('summaryScoreMode', val)
      },

      setResolution(res: number) {
        self.resolution = res
      },

      setFeatureUnderMouse(feat?: typeof self.featureUnderMouse) {
        self.featureUnderMouse = feat
      },

      setAutoscale(val?: string) {
        self.setOverride('autoscale', val)
      },

      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
      },
    }))
    .actions(self => {
      async function fetchFeaturesForRegion(
        region: RegionWithNumber,
        stopToken: StopToken,
        bpPerPx: number,
        resolution: number,
        generation: number,
      ) {
        const session = getSession(self)
        const { rpcManager } = session
        const { adapterConfig } = self.adapterProps()

        if (!adapterConfig) {
          return
        }

        const result = await rpcManager.call(
          getRpcSessionId(self),
          'RenderWiggleData',
          {
            adapterConfig,
            region: region.region,
            bicolorPivot: self.effectiveBicolorPivot,
            stopToken,
            bpPerPx,
            resolution,
            statusCallback: (msg: string) => {
              if (isAlive(self)) {
                self.setStatusMessage(msg)
              }
            },
          },
        )

        if (isAlive(self) && generation === self.fetchGeneration) {
          self.setRpcDataForRegion(region.regionNumber, result)
          self.setLoadedBpPerPxForRegion(region.regionNumber, bpPerPx)
        }
      }

      const superAfterAttach = self.afterAttach

      let prevPivot: number | undefined
      let prevResolution: number | undefined

      return {
        isCacheValid(regionNumber: number) {
          const view = getContainingView(self) as LGV
          const regionBpPerPx = untracked(() =>
            self.loadedBpPerPx.get(regionNumber),
          )
          return (
            regionBpPerPx === undefined || view.bpPerPx >= regionBpPerPx / 2
          )
        },

        onFetchNeeded(needed: RegionWithNumber[]) {
          const view = getContainingView(self) as LGV
          const { bpPerPx } = view
          const { resolution } = self
          self.withFetchLifecycle(needed, async (ctx: FetchContext) => {
            const promises = needed.map(region =>
              fetchFeaturesForRegion(
                region,
                ctx.stopToken,
                bpPerPx,
                resolution,
                ctx.generation,
              ),
            )
            await Promise.all(promises)
          })
        },

        afterAttach() {
          superAfterAttach()

          addDisposer(
            self,
            autorun(
              () => {
                const pivot = self.effectiveBicolorPivot
                if (prevPivot !== undefined && pivot !== prevPivot) {
                  self.clearAllRpcData()
                }
                prevPivot = pivot
              },
              { name: 'BicolorPivotChange' },
            ),
          )

          addDisposer(
            self,
            autorun(
              () => {
                const { resolution } = self
                if (
                  prevResolution !== undefined &&
                  resolution !== prevResolution
                ) {
                  self.clearAllRpcData()
                }
                prevResolution = resolution
              },
              { name: 'ResolutionChange' },
            ),
          )

          addDisposer(
            self,
            autorun(
              () => {
                const view = getContainingView(self) as LGV
                if (!view.initialized) {
                  return
                }
                const numStdDev = self.getConfWithOverride<number>('numStdDev')
                const visibleEntries = view.dynamicBlocks.contentBlocks.flatMap(
                  block => {
                    const data = self.rpcDataMap.get(block.regionNumber!)
                    if (!data) {
                      return []
                    }
                    return [
                      {
                        visStart: block.start - data.regionStart,
                        visEnd: block.end - data.regionStart,
                        data,
                      },
                    ]
                  },
                )
                const allEntries = [...self.rpcDataMap.values()].map(data => ({
                  data,
                }))
                const range = computeAutoscaleDomain(
                  self.autoscaleType,
                  self.summaryScoreMode,
                  numStdDev,
                  visibleEntries,
                  allEntries,
                )
                if (
                  range &&
                  (range[0] !== self.visibleScoreRange?.[0] ||
                    range[1] !== self.visibleScoreRange[1])
                ) {
                  self.setVisibleScoreRange(range)
                }
              },
              { delay: 400, name: 'VisibleScoreRange' },
            ),
          )
        },
      }
    })
    .views(self => ({
      trackMenuItems() {
        return [
          {
            label: 'Rendering type',
            subMenu: [
              {
                label: 'XY plot',
                type: 'radio',
                checked: self.renderingType === 'xyplot',
                onClick: () => {
                  self.setRenderingType('xyplot')
                },
              },
              {
                label: 'Density',
                type: 'radio',
                checked: self.renderingType === 'density',
                onClick: () => {
                  self.setRenderingType('density')
                },
              },
              {
                label: 'Line',
                type: 'radio',
                checked: self.renderingType === 'line',
                onClick: () => {
                  self.setRenderingType('line')
                },
              },
              {
                label: 'Scatter',
                type: 'radio',
                checked: self.renderingType === 'scatter',
                onClick: () => {
                  self.setRenderingType('scatter')
                },
              },
            ],
          },
          ...(self.hasResolution
            ? [
                {
                  label: 'Resolution',
                  subMenu: [
                    {
                      label: 'Finer resolution',
                      onClick: () => {
                        self.setResolution(self.resolution * 5)
                      },
                    },
                    {
                      label: 'Coarser resolution',
                      onClick: () => {
                        self.setResolution(self.resolution / 5)
                      },
                    },
                  ],
                },
                {
                  label: 'Summary score mode',
                  subMenu: (['min', 'max', 'avg', 'whiskers'] as const).map(
                    elt => ({
                      label: elt,
                      type: 'radio' as const,
                      checked: self.summaryScoreMode === elt,
                      onClick: () => {
                        self.setSummaryScoreMode(elt)
                      },
                    }),
                  ),
                },
              ]
            : []),
          {
            label: 'Score',
            icon: EqualizerIcon,
            subMenu: [
              {
                label: 'Scale type',
                subMenu: [
                  {
                    label: 'Linear scale',
                    type: 'radio',
                    checked: self.scaleType === 'linear',
                    onClick: () => {
                      self.setScaleType('linear')
                    },
                  },
                  {
                    label: 'Log scale',
                    type: 'radio',
                    checked: self.scaleType === 'log',
                    onClick: () => {
                      self.setScaleType('log')
                    },
                  },
                ],
              },
              {
                label: 'Autoscale type',
                subMenu: (
                  [
                    ['local', 'Local'],
                    ['global', 'Global'],
                    ['globalsd', 'Global ± 3σ'],
                    ['localsd', 'Local ± 3σ'],
                  ] as const
                ).map(([val, label]) => ({
                  label,
                  type: 'radio' as const,
                  checked: self.autoscaleType === val,
                  onClick: () => {
                    self.setAutoscale(val)
                  },
                })),
              },
              {
                label: 'Set min/max score',
                onClick: () => {
                  getSession(self).queueDialog(handleClose => [
                    SetMinMaxDialog,
                    {
                      model: self,
                      handleClose,
                    },
                  ])
                },
              },
            ],
          },
          {
            label: 'Color',
            icon: PaletteIcon,
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                SetColorDialog,
                {
                  model: self,
                  handleClose,
                },
              ])
            },
          },
          {
            label: 'Draw cross hatches',
            type: 'checkbox',
            checked: self.displayCrossHatches,
            onClick: () => {
              self.toggleCrossHatches()
            },
          },
        ]
      },
    }))
    .actions(self => ({
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearWiggleDisplayModel, opts)
      },
    }))
}

export type LinearWiggleDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearWiggleDisplayModel = Instance<LinearWiggleDisplayStateModel>
