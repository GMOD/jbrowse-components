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
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import EqualizerIcon from '@mui/icons-material/Equalizer'
import PaletteIcon from '@mui/icons-material/Palette'
import { observable } from 'mobx'

import axisPropsFromTickScale from '../shared/axisPropsFromTickScale.ts'
import { migrateWiggleSnapshot } from '../shared/migrateWiggleSnapshot.ts'
import { makeRenderState } from '../shared/wiggleComponentUtils.ts'
import {
  YSCALEBAR_LABEL_OFFSET,
  computeAutoscaleDomain,
  getNiceDomain,
  getScale,
  isDefaultBicolor,
} from '../util.ts'
import { buildSourceRenderData } from './components/buildSourceRenderData.ts'

import type { WiggleDataResult } from '../RenderWiggleDataRPC/types.ts'
import type {
  WiggleBackend,
  WiggleGPURenderState,
} from '../shared/wiggleBackendTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { Region } from '@jbrowse/core/util'
import type {
  ExportSvgDisplayOptions,
  FetchContext,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

export type { Region } from '@jbrowse/core/util'

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
    .preProcessSnapshot(
      // @ts-expect-error - MST's preProcessSnapshot typing can't verify the
      // return type against the model creation type
      (snap: Record<string, unknown> | null | undefined) => {
        if (!snap) {
          return snap
        }

        // Strip properties from old BaseLinearDisplay snapshots
        const { blockState, showLegend, showTooltips, ...withoutLegacy } = snap

        // Rewrite "height" from older snapshots to "heightPreConfig"
        if (
          withoutLegacy.height !== undefined &&
          withoutLegacy.heightPreConfig === undefined
        ) {
          const { height, ...rest } = withoutLegacy
          return migrateWiggleSnapshot({ ...rest, heightPreConfig: height })
        }

        return migrateWiggleSnapshot(withoutLegacy)
      },
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, WiggleDataResult>(),
      // The bpPerPx at which all currently-loaded regions were fetched.
      // One value for the whole model, not per-region — this is what
      // structurally guarantees adjacent regions render at the same
      // resolution. Updated atomically with rpcDataMap inside fetchRegions.
      loadedBpPerPx: undefined as number | undefined,
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

      // Autoscale range = max/min over whatever is currently on screen.
      // Cached view, recomputes when any input moves. Replaces the
      // previous VisibleScoreRange autorun + volatile.
      //
      // Iterates `mergedVisibleRegions` (one entry per displayedRegionIndex with
      // the merged on-screen bp span) rather than `dynamicBlocks.contentBlocks`
      // — a single region can appear as multiple content blocks, but for
      // autoscale we only need the merged visible slice.
      get visibleScoreRange(): [number, number] | undefined {
        const view = getContainingView(self) as LGV
        if (!view.initialized || self.rpcDataMap.size === 0) {
          return undefined
        }
        const numStdDev = self.getConfWithOverride<number>('numStdDev')
        const visibleEntries = view.mergedVisibleRegions.flatMap(vr => {
          const data = self.rpcDataMap.get(vr.displayedRegionIndex)
          if (!data) {
            return []
          }
          return [
            {
              visStart: vr.start - data.regionStart,
              visEnd: vr.end - data.regionStart,
              data,
            },
          ]
        })
        const allEntries = [...self.rpcDataMap.values()].map(data => ({
          data,
        }))
        return computeAutoscaleDomain(
          this.autoscaleType,
          this.summaryScoreMode,
          numStdDev,
          visibleEntries,
          allEntries,
        )
      },

      get domain(): [number, number] | undefined {
        const range = this.visibleScoreRange
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

      get renderState() {
        const domain = this.domain
        if (!domain) {
          return undefined
        }
        const view = getContainingView(self) as LGV
        return makeRenderState(
          domain,
          this.scaleType,
          this.renderingType,
          view.trackWidthPx,
          self.height,
        )
      },

      // Settings sent to the worker via RPC. Adding a field here propagates
      // both into the RPC payload (via fetchFeaturesForRegion) and into the
      // SettingsInvalidate autorun (which reads this getter), so refetch
      // happens automatically when any field changes — no separate cache
      // key to maintain.
      get rpcProps() {
        return {
          bicolorPivot: this.effectiveBicolorPivot,
          resolution: self.resolution,
        }
      },

      // Settings consumed during main-thread GPU buffer encoding
      // (buildSourceRenderData), not sent to the worker. Counterpart to
      // rpcProps for things that affect the GPU side instead of the RPC
      // side. Defined as a method (not a getter) so subclasses can
      // override it via the standard `super` capture pattern in composed
      // views. The return shape is enforced structurally by
      // buildSourceRenderData's `WiggleGpuProps` parameter type.
      gpuProps() {
        return {
          color: this.color,
          posColor: this.posColor,
          negColor: this.negColor,
          summaryScoreMode: this.summaryScoreMode,
          isDensityMode: this.isDensityMode,
          renderingType: this.renderingType,
        }
      },
    }))
    .actions(self => ({
      setRpcData(displayedRegionIndex: number, data: WiggleDataResult) {
        self.rpcDataMap.set(displayedRegionIndex, data)
      },

      setLoadedBpPerPx(bpPerPx: number | undefined) {
        self.loadedBpPerPx = bpPerPx
      },

      clearDisplaySpecificData() {
        self.rpcDataMap.clear()
        self.loadedBpPerPx = undefined
      },

      startGpuBackendLifecycle(backend: WiggleBackend) {
        self.startMultiRegionGpuLifecycle<WiggleBackend, WiggleGPURenderState>({
          backend,
          uploads: [
            {
              getData: () => self.rpcDataMap,
              // mobx tracks every observable `upload` reads — both
              // `data` (per-region) and `self.gpuProps()` (color,
              // summaryScoreMode, ...). When any of them changes the
              // autorun re-fires and re-uploads. No cache, no diff.
              //
              // Worker-affecting settings (rpcProps) take a separate
              // path: SettingsInvalidate clears rpcDataMap and lets
              // fetch re-run.
              upload: (b, displayedRegionIndex, data) => {
                b.uploadRegion(
                  displayedRegionIndex,
                  data.regionStart,
                  buildSourceRenderData(data, self.gpuProps()),
                )
              },
              prune: (b, activeDisplayedRegionIndices) => {
                b.pruneRegions(activeDisplayedRegionIndices)
              },
            },
          ],
          renderBlocks: () => self.renderBlocks,
          renderState: () => self.renderState,
          render: (b, blocks, state) => {
            b.renderBlocks(blocks, state)
          },
        })
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
    .actions(self => ({
      isCacheValid(_displayedRegionIndex: number) {
        if (self.loadedBpPerPx === undefined) {
          return true
        }
        const view = getContainingView(self) as LGV
        return view.bpPerPx >= self.loadedBpPerPx / 2
      },

      onFetchNeeded(
        needed: { region: Region; displayedRegionIndex: number }[],
      ) {
        const view = getContainingView(self) as LGV
        const { adapterConfig } = self.adapterProps()
        if (!adapterConfig) {
          return
        }
        // Pick the bpPerPx for this fetch: if existing loaded data is
        // still within the 2x cache threshold, fetch at the same
        // resolution so newly-visible regions match what's already on
        // screen. Otherwise the cache is stale and the autorun has
        // queued every visible region — fetch them all at the new
        // viewport resolution.
        const cacheValid =
          self.loadedBpPerPx !== undefined &&
          view.bpPerPx >= self.loadedBpPerPx / 2
        const bpPerPx = cacheValid ? self.loadedBpPerPx! : view.bpPerPx
        const sessionId = getRpcSessionId(self)
        const { rpcManager } = getSession(self)
        self.fetchRegions(needed, async (ctx: FetchContext) => {
          await Promise.all(
            needed.map(async r => {
              const result = await rpcManager.call(
                sessionId,
                'RenderWiggleData',
                {
                  sessionId,
                  adapterConfig,
                  region: r.region,
                  ...self.rpcProps,
                  stopToken: ctx.stopToken,
                  bpPerPx,
                  statusCallback: (msg: string) => {
                    if (isAlive(self)) {
                      self.setStatusMessage(msg)
                    }
                  },
                },
              )
              if (!ctx.isStale()) {
                self.setRpcData(r.displayedRegionIndex, result)
              }
            }),
          )
          if (!ctx.isStale()) {
            self.setLoadedBpPerPx(bpPerPx)
          }
        })
      },
    }))
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
