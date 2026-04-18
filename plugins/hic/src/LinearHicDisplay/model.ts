import type React from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ConfigOverrideMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import { generateColorRamp } from './components/HicRenderer.ts'
import { HIC_LINEAR_SCORE_DIVISOR } from './components/colorRamp.ts'

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
 * - [MultiRegionDisplayMixin](../multiregiondisplaymixin)
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
      MultiRegionDisplayMixin(),
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
      statusMessage: undefined as string | undefined,
      /**
       * #volatile
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       */
      lastDrawnBpPerPx: undefined as number | undefined,
      /**
       * #volatile
       */
      availableNormalizations: undefined as string[] | undefined,
      /**
       * #volatile
       */
      flatbush: undefined as ArrayBuffer | undefined,
      /**
       * #volatile
       */
      flatbushItems: [] as HicFlatbushItem[],
      /**
       * #volatile
       */
      maxScore: 0,
      /**
       * #volatile
       */
      yScalar: 1,
    }))
    .preProcessSnapshot((snap: any) => {
      if (!snap) {
        return snap
      }
      const { colorScheme, showLegend, ...rest } = snap
      const overrides: Record<string, unknown> = {}
      if (colorScheme !== undefined) {
        overrides.colorScheme = colorScheme
      }
      if (showLegend !== undefined) {
        overrides.showLegend = showLegend
      }
      if (Object.keys(overrides).length === 0) {
        return rest
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
      get rendererTypeName() {
        return 'HicRenderer'
      },
      get drawn() {
        return !!self.rpcData
      },
      get fullyDrawn() {
        return !!self.rpcData
      },
      get loading() {
        return self.isLoading
      },
    }))
    .views(self => ({
      renderProps() {
        return { notReady: true }
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
        const scale =
          self.lastDrawnBpPerPx !== undefined
            ? self.lastDrawnBpPerPx / view.bpPerPx
            : 1
        const offsetX =
          self.lastDrawnOffsetPx !== undefined
            ? self.lastDrawnOffsetPx * scale - view.offsetPx
            : 0
        return {
          binWidth: data.binWidth,
          yScalar: data.yScalar,
          canvasWidth: Math.round(view.dynamicBlocks.totalWidthPx),
          canvasHeight: self.height,
          maxScore: data.maxScore,
          useLogScale: self.useLogScale,
          viewScale: scale,
          viewOffsetX: offsetX,
        }
      },

      /**
       * #method
       * Returns legend items for the Hi-C color scale
       */
      legendItems(): LegendItem[] {
        const colorScheme = self.colorScheme ?? 'juicebox'
        const displayMax = self.useLogScale
          ? self.maxScore
          : Math.round(self.maxScore / HIC_LINEAR_SCORE_DIVISOR)
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
       * Called by the React component when useGpuRenderer's factory resolves.
       * The autorun tracks self.rpcData, self.colorScheme, and self.renderState
       * via cached MST getters — rpcData and colorScheme are identity-diffed
       * independently so a colorScheme change doesn't re-upload contact data.
       */
      startGpuBackendLifecycle(backend: HicBackend) {
        self.startSingleDataGpuLifecycle<
          HicBackend,
          NonNullable<typeof self.renderState>
        >({
          backend,
          uploadSlots: [
            {
              readData: () => self.rpcData,
              commitUpload: (b, data) => {
                const d = data as HicDataResult
                b.uploadData({
                  positions: d.positions,
                  counts: d.counts,
                  numContacts: d.numContacts,
                })
              },
            },
            {
              readData: () => self.colorScheme ?? 'juicebox',
              commitUpload: (b, scheme) => {
                b.uploadColorRamp(generateColorRamp(scheme as string))
              },
            },
          ],
          getRenderState: () => self.renderState,
          renderWithState: (b, state) => {
            b.render(state)
          },
        })
      },
      /**
       * #action
       */
      setFlatbushData(
        flatbush: ArrayBuffer | undefined,
        items: HicFlatbushItem[],
        maxScore: number,
        yScalar: number,
      ) {
        self.flatbush = flatbush
        self.flatbushItems = items
        self.maxScore = maxScore
        self.yScalar = yScalar
      },
      /**
       * #action
       */
      setStatusMessage(msg?: string) {
        self.statusMessage = msg
      },
      /**
       * #action
       */
      setLastDrawnOffsetPx(px: number) {
        self.lastDrawnOffsetPx = px
      },
      /**
       * #action
       */
      setLastDrawnBpPerPx(bpPerPx: number) {
        self.lastDrawnBpPerPx = bpPerPx
      },
      /**
       * #action
       */
      reload() {
        self.error = undefined
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
