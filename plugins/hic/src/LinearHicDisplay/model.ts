import type React from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { isAlive, types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  GlobalDataDisplayMixin,
  StaleViewportRescaleMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import { generateColorRamp } from './components/HicRenderer.ts'

import type {
  HicContactItem,
  HicDataResult,
} from '../RenderHicDataRPC/types.ts'
import type { HicBackend } from './components/hicBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearHicDisplay
 * #category display
 * Hi-C display that renders contact matrix using WebGL
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [GlobalDataDisplayMixin](../globaldatadisplaymixin)
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearHicDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      GlobalDataDisplayMixin(),
      StaleViewportRescaleMixin(),
      ConfigOverrideMixin(),
      types.model({
        type: types.literal('LinearHicDisplay'),
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         * User-selected binsize (one of the file's available resolutions).
         * Undefined means "auto" — pick a binsize from `availableResolutions`
         * based on the current view's bpPerPx on every fetch.
         */
        resolution: types.maybe(types.number),
        useLogScale: false,
        /**
         * #property
         * Color saturation point: false → maxScore/20 (linear) or maxScore
         * (log), matches legacy behavior. true → 95th percentile of counts;
         * lower saturation point so off-diagonal contacts read more strongly.
         */
        useColorPercentile: false,
        activeNormalization: 'KR',
        mode: 'triangular',
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as HicDataResult | null,
      /**
       * #volatile
       */
      availableNormalizations: undefined as string[] | undefined,
      /**
       * #volatile
       */
      availableResolutions: undefined as number[] | undefined,
    }))
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }
      // The old `resolution` field was a multiplier (default 1) on
      // auto-selected binsize. The new `resolution` is a discrete binsize
      // from the file (5000, 10000, …). Anything < 1000 in old snapshots
      // is almost certainly a stale multiplier — drop it so the model
      // falls back to auto-mode.
      if (snap.resolution !== undefined && snap.resolution < 1000) {
        const { resolution: _drop, ...withoutRes } = snap
        snap = withoutRes
      }
      const { colorScheme, showLegend, ...rest } = snap
      if (colorScheme === undefined && showLegend === undefined) {
        return rest
      }
      const overrides = {
        ...(colorScheme !== undefined && { colorScheme }),
        ...(showLegend !== undefined && { showLegend }),
      }
      return {
        ...rest,
        configOverrides: { ...rest.configOverrides, ...overrides },
      }
    })
    .views(self => ({
      get colorScheme(): string | undefined {
        return self.getOverride<string>('colorScheme')
      },
      get showLegend(): boolean | undefined {
        return self.getOverride<boolean>('showLegend')
      },
      get items(): HicContactItem[] {
        return self.rpcData?.items ?? []
      },
      get hoverLookup(): Record<string, number> | undefined {
        return self.rpcData?.lookup
      },
      get regionPixelStarts(): number[] | undefined {
        return self.rpcData?.regionPixelStarts
      },
      get regionCombinedOffsets(): number[] | undefined {
        return self.rpcData?.regionCombinedOffsets
      },
      get binWidth(): number | undefined {
        return self.rpcData?.binWidth
      },
      get colorMaxScore() {
        const data = self.rpcData
        if (!data) {
          return 0
        }
        if (self.useColorPercentile) {
          return data.percentile95
        }
        return self.useLogScale ? data.maxScore : data.maxScore / 20
      },
      /**
       * #getter
       * The actual binsize to fetch at — user override if set, else
       * auto-picked (largest available binsize ≤ 2*bpPerPx).
       */
      get effectiveResolution(): number | undefined {
        const avail = self.availableResolutions
        if (!avail?.length) {
          return undefined
        }
        const userSet = self.resolution
        if (userSet !== undefined && avail.includes(userSet)) {
          return userSet
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        const bpPerPx = Math.max(1, view.bpPerPx)
        // avail is sorted ascending (smallest binsize first); pick the
        // largest binsize ≤ 2*bpPerPx, falling back to the smallest if
        // none qualify (very zoomed in).
        let chosen = avail[0]!
        for (const r of avail) {
          if (r <= 2 * bpPerPx) {
            chosen = r
          }
        }
        return chosen
      },
      get yScalar() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const defaultHeight = view.totalWidthPx / 2
        const height = self.height
        return self.mode === 'adjust' ? height / Math.max(height, defaultHeight) : 1
      },
    }))
    .views(self => ({
      // Literal RPC payload for RenderHicData. Adding a field here flows
      // into both the RPC call (via the fetch autorun in afterAttach.ts)
      // and into mobx's dependency tracking — the fetch autorun calls
      // `self.rpcProps()` once, so any change refires it.
      rpcProps() {
        return {
          resolution: self.effectiveResolution,
          normalization: self.activeNormalization,
        }
      },

      /**
       * #getter
       * Combined { scale, viewOffsetX } that places data-x=0 (the apex of
       * the rotated triangle = first visible block's start at fetch time)
       * at its correct canvas-x in the current viewport. Survives
       * stale-zoom and stale-pan by deriving from lastDrawnOffsetPx /
       * lastDrawnBpPerPx — read by both the GPU render path and the
       * mouse hit-test so they stay in sync.
       *
       * Apex was rendered at canvas-x = max(0, -lastDrawnOffsetPx) at
       * fetch time. That maps to genome-pixel position
       *   apexGenomePx = max(0, lastDrawnOffsetPx)   (in fetch px units)
       * Convert to current px and offset by current view:
       *   viewOffsetX = apexGenomePx * scale - view.offsetPx
       */
      get renderTransform() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const last = self.lastDrawnOffsetPx ?? view.offsetPx
        const lastBpPerPx = self.lastDrawnBpPerPx ?? view.bpPerPx
        const scale = lastBpPerPx / view.bpPerPx
        const apexGenomePx = Math.max(0, last)
        return {
          scale,
          viewOffsetX: apexGenomePx * scale - view.offsetPx,
        }
      },
    }))
    .views(self => ({
      /**
       * #method
       * Computed per-frame render state for the GPU backend. Read by the
       * autorun lifecycle on every change to any tracked observable.
       */
      get renderState() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const data = self.rpcData
        if (!data) {
          return undefined
        }
        const { scale, viewOffsetX } = self.renderTransform
        return {
          binWidth: data.binWidth,
          yScalar: self.yScalar,
          canvasWidth: view.totalWidthPx,
          canvasHeight: self.height,
          colorMaxScore: self.colorMaxScore,
          useLogScale: self.useLogScale,
          viewScale: scale,
          viewOffsetX,
        }
      },

      /**
       * #method
       * Width of the SVG legend (consumed by SVGLinearGenomeView). Returns 0
       * when no legend will be drawn so the export framework can omit space.
       */
      svgLegendWidth(): number {
        return self.showLegend && self.colorMaxScore > 0 ? 140 : 0
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setRpcData(data: HicDataResult | null) {
        self.rpcData = data
      },
      /**
       * #action
       * Called by the React hook (`useGpuModelLifecycle`) when the HAL
       * resolves. Wires the backend into the mixin-owned autorun pair via
       * `installGpuDisplay`.
       */
      startGpuBackendLifecycle(backend: HicBackend) {
        self.installGpuDisplay<HicBackend>(backend, {
          upload: b => {
            const data = self.rpcData
            if (data) {
              b.uploadData({
                positions: data.positions,
                counts: data.counts,
                numContacts: data.numContacts,
              })
            }
            b.uploadColorRamp(generateColorRamp(self.colorScheme ?? 'juicebox'))
          },
          render: b => {
            const state = self.renderState
            if (!state) {
              return false
            }
            b.render(state)
            return true
          },
        })
      },
      /**
       * #action
       */
      setResolution(n: number | undefined) {
        self.resolution = n
      },
      /**
       * #action
       */
      setUseLogScale(f: boolean) {
        self.useLogScale = f
      },
      /**
       * #action
       */
      setUseColorPercentile(f: boolean) {
        self.useColorPercentile = f
      },
      /**
       * #action
       */
      setColorScheme(f?: string) {
        self.setOverride('colorScheme', f)
      },
      /**
       * #action
       */
      setActiveNormalization(f: string) {
        self.activeNormalization = f
      },
      /**
       * #action
       */
      setAvailableNormalizations(f: string[]) {
        self.availableNormalizations = f
      },
      /**
       * #action
       */
      setMode(arg: string) {
        self.mode = arg
      },
      /**
       * #action
       */
      setShowLegend(arg: boolean) {
        self.setOverride('showLegend', arg)
      },
      /**
       * #action
       */
      setAvailableResolutions(f: number[]) {
        // Sort ascending (smallest binsize first) so index-based stepping is
        // consistent regardless of the order returned by hic-straw. This
        // makes "Finer" = idx-1 = smaller binsize and "Coarser" = idx+1 =
        // larger binsize.
        self.availableResolutions = [...f].sort((a, b) => a - b)
      },
      /**
       * #action
       */
      zoomResolutionCoarser() {
        // Step relative to whatever's currently effective so the first
        // click does what the user expects even when in auto-mode.
        const avail = self.availableResolutions
        if (!avail?.length) {
          return
        }
        const cur = self.effectiveResolution ?? avail[0]!
        const idx = avail.indexOf(cur)
        if (idx !== -1 && idx < avail.length - 1) {
          self.resolution = avail[idx + 1]
        }
      },
      /**
       * #action
       */
      zoomResolutionFiner() {
        const avail = self.availableResolutions
        if (!avail?.length) {
          return
        }
        const cur = self.effectiveResolution ?? avail[0]!
        const idx = avail.indexOf(cur)
        if (idx !== -1 && idx > 0) {
          self.resolution = avail[idx - 1]
        }
      },
      /**
       * #action
       * Clear the user override so resolution auto-tracks bpPerPx again.
       */
      resetResolutionToAuto() {
        self.resolution = undefined
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Use log scale',
              type: 'checkbox',
              checked: self.useLogScale,
              onClick: () => {
                self.setUseLogScale(!self.useLogScale)
              },
            },
            {
              label: 'Use 95th percentile color scale',
              type: 'checkbox',
              checked: self.useColorPercentile,
              onClick: () => {
                self.setUseColorPercentile(!self.useColorPercentile)
              },
            },
            {
              label: 'Show legend',
              type: 'checkbox',
              checked: self.showLegend,
              onClick: () => {
                self.setShowLegend(!self.showLegend)
              },
            },
            {
              label: 'Rendering mode',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Triangular',
                  type: 'radio',
                  checked: self.mode === 'triangular',
                  onClick: () => {
                    self.setMode('triangular')
                  },
                },
                {
                  label: 'Adjust to height of display',
                  type: 'radio',
                  checked: self.mode === 'adjust',
                  onClick: () => {
                    self.setMode('adjust')
                  },
                },
              ],
            },
            {
              label: 'Color scheme',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Fall',
                  type: 'radio',
                  checked: self.colorScheme === 'fall',
                  onClick: () => {
                    self.setColorScheme('fall')
                  },
                },
                {
                  label: 'Viridis',
                  type: 'radio',
                  checked: self.colorScheme === 'viridis',
                  onClick: () => {
                    self.setColorScheme('viridis')
                  },
                },
                {
                  label: 'Juicebox',
                  type: 'radio',
                  checked: self.colorScheme === 'juicebox',
                  onClick: () => {
                    self.setColorScheme('juicebox')
                  },
                },
                {
                  label: 'Default',
                  type: 'radio',
                  checked: self.colorScheme === undefined,
                  onClick: () => {
                    self.setColorScheme(undefined)
                  },
                },
              ],
            },

            {
              label: 'Resolution',
              subMenu: [
                {
                  label: 'Finer resolution',
                  onClick: () => {
                    self.zoomResolutionFiner()
                  },
                },
                {
                  label: 'Coarser resolution',
                  onClick: () => {
                    self.zoomResolutionCoarser()
                  },
                },
                {
                  label: 'Auto (track zoom)',
                  type: 'checkbox',
                  checked: self.resolution === undefined,
                  onClick: () => {
                    self.resetResolutionToAuto()
                  },
                },
              ],
            },
            ...(self.availableNormalizations
              ? [
                  {
                    label: 'Normalization scheme',
                    subMenu: self.availableNormalizations.map(norm => ({
                      label: norm,
                      type: 'radio',
                      checked: norm === self.activeNormalization,
                      onClick: () => {
                        self.setActiveNormalization(norm)
                      },
                    })),
                  },
                ]
              : []),
          ]
        },

        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self as LinearHicDisplayModel, opts)
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Re-fetches contact matrix for the current viewport. Both the
       * autorun (in `afterAttach`) and `reload()` invoke this directly.
       */
      async performHicFetch() {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LinearGenomeViewModel
        if (!view.initialized) {
          return
        }
        const regions = view.dynamicBlocks.contentBlocks
        if (!regions.length) {
          return
        }
        const { bpPerPx } = view
        const { adapterConfig } = self
        await self.runFetch(async ctx => {
          const { rpcManager } = getSession(self)
          const result = await rpcManager.call(
            getRpcSessionId(self),
            'RenderHicData',
            {
              adapterConfig,
              regions: [...regions],
              bpPerPx,
              ...self.rpcProps(),
              stopToken: ctx.stopToken,
            },
            {
              statusCallback: (msg: string) => {
                if (isAlive(self)) {
                  self.setStatusMessage(msg)
                }
              },
            },
          )
          if (ctx.isStale()) {
            return
          }
          self.setRpcData(result)
          self.setLastDrawnViewport(view.offsetPx, view.bpPerPx)
        })
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      reload() {
        self.setError(undefined)
        // TODO find way to avoid manually triggering fetch here instead just bumping a redraw counter or something
        void self.performHicFetch()
      },
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('./afterAttach.ts')
            doAfterAttach(self)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type LinearHicDisplayStateModel = ReturnType<typeof stateModelFactory>
export type LinearHicDisplayModel = Instance<LinearHicDisplayStateModel>
