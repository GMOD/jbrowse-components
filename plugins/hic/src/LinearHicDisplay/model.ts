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
  HicDataResult,
  HicFlatbushItem,
} from '../RenderHicDataRPC/types.ts'
import type { HicBackend } from './components/hicBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
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
        resolution: types.optional(types.number, 1),
        useLogScale: false,
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
    }))
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }
      const { colorScheme, showLegend, ...rest } = snap
      if (colorScheme === undefined && showLegend === undefined) {
        return rest
      }
      const overrides = {
        ...(colorScheme !== undefined && { colorScheme }),
        ...(showLegend !== undefined && { showLegend }),
      }
      return { ...rest, configOverrides: { ...rest.configOverrides, ...overrides } }
    })
    .views(self => ({
      get colorScheme(): string | undefined {
        return self.getOverride<string>('colorScheme')
      },
      get showLegend(): boolean | undefined {
        return self.getOverride<boolean>('showLegend')
      },
      get rendererTypeName() {
        return 'HicRenderer'
      },
      get flatbush() {
        return self.rpcData?.flatbush
      },
      get flatbushItems(): HicFlatbushItem[] {
        return self.rpcData?.items ?? []
      },
      get maxScore() {
        return self.rpcData?.maxScore ?? 0
      },
      get colorMaxScore() {
        return self.rpcData?.colorMaxScore ?? 0
      },
      get yScalar() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const hyp = Math.round(view.dynamicBlocks.totalWidthPx) / 2
        const h = self.height
        return self.mode === 'adjust' ? h / Math.max(h, hyp) : 1
      },
    }))
    .views(self => ({
      // Literal RPC payload for RenderHicData. Adding a field here flows
      // into both the RPC call (via the fetch autorun in afterAttach.ts)
      // and into mobx's dependency tracking — the fetch autorun reads
      // `self.rpcProps` once, so any change refires it.
      get rpcProps() {
        return {
          resolution: self.resolution,
          normalization: self.activeNormalization,
        }
      },

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
        const { scale, translateX } = self.viewportTransform(view)
        return {
          binWidth: data.binWidth,
          yScalar: self.yScalar,
          canvasWidth: Math.round(view.dynamicBlocks.totalWidthPx),
          canvasHeight: self.height,
          maxScore: data.maxScore,
          colorMaxScore: data.colorMaxScore,
          useLogScale: self.useLogScale,
          viewScale: scale,
          viewOffsetX: translateX,
        }
      },

      /**
       * #method
       * Returns legend items for the Hi-C color scale
       */
      legendItems(): LegendItem[] {
        const colorScheme = self.colorScheme ?? 'juicebox'
        const displayMax = Math.round(
          self.useLogScale ? self.maxScore : self.colorMaxScore,
        )
        const minLabel = self.useLogScale ? '1' : '0'
        const maxLabel = `${displayMax.toLocaleString()}${self.useLogScale ? ' (log)' : ''}`

        return [
          {
            label: `${minLabel} - ${maxLabel} (${colorScheme})`,
          },
        ]
      },

      /**
       * #method
       * Returns the width needed for the SVG legend if showLegend is enabled.
       */
      svgLegendWidth(): number {
        return self.showLegend && self.maxScore > 0 ? 140 : 0
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
      setResolution(n: number) {
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
                    self.setResolution(self.resolution * 2)
                  },
                },
                {
                  label: 'Coarser resolution',
                  onClick: () => {
                    self.setResolution(self.resolution / 2)
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
              ...self.rpcProps,
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
