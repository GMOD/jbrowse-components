import type React from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import type { HicFlatbushItem } from '../HicRenderer/types.ts'
import type { WebGLHicDataResult } from '../RenderWebGLHicDataRPC/types.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearHicDisplay
 * #category display
 * Hi-C display that renders contact matrix using WebGL
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
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
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearHicDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        resolution: types.optional(types.number, 1),
        /**
         * #property
         */
        useLogScale: false,
        /**
         * #property
         */
        colorScheme: types.maybe(types.string),
        /**
         * #property
         */
        activeNormalization: 'KR',
        /**
         * #property
         */
        mode: 'triangular',
        /**
         * #property
         */
        showLegend: types.maybe(types.boolean),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       */
      rpcData: null as WebGLHicDataResult | null,
      /**
       * #volatile
       */
      loading: false,
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
      renderingStopToken: undefined as string | undefined,
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
    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'HicRenderer'
      },
      get drawn() {
        return !!self.rpcData
      },
      get fullyDrawn() {
        return !!self.rpcData
      },
    }))
    .views(self => ({
      renderProps() {
        return { notReady: true }
      },

      /**
       * #method
       * Returns legend items for the Hi-C color scale
       */
      legendItems(): LegendItem[] {
        const colorScheme = self.colorScheme ?? 'juicebox'
        const displayMax = self.useLogScale
          ? self.maxScore
          : Math.round(self.maxScore / 20)
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
      setRpcData(data: WebGLHicDataResult | null) {
        self.rpcData = data
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
      setLoading(loading: boolean) {
        self.loading = loading
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
      setRenderingStopToken(token?: string) {
        self.renderingStopToken = token
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
        self.colorScheme = f
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
        self.showLegend = arg
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
