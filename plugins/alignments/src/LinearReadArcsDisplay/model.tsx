import React, { lazy } from 'react'
import { cast, types, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  ConfigurationSchema,
  getConf,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'

// icons
import PaletteIcon from '@mui/icons-material/Palette'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { FilterModel } from '../shared'
import drawFeats from './drawFeats'
import { fetchChains, ChainData } from '../shared/fetchChains'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { createAutorun } from '../util'

// async
const FilterByTagDlg = lazy(() => import('../shared/FilterByTag'))

interface Filter {
  flagInclude: number
  flagExclude: number
  readName?: string
  tagFilter?: { tag: string; value: string }
}

/**
 * #stateModel LinearReadArcsDisplay
 * extends `BaseDisplay`, it is not a block based track, hence not BaseLinearDisplay
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReadArcsDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearReadArcsDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        filterBy: types.optional(FilterModel, {}),

        /**
         * #property
         */
        lineWidth: types.maybe(types.number),

        /**
         * #property
         */
        jitter: types.maybe(types.number),

        /**
         * #property
         */
        colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
            extra: types.frozen(),
          }),
        ),

        /**
         * #property
         */
        drawInter: true,

        /**
         * #property
         */
        drawLongRange: true,
      }),
    )
    .volatile(() => ({
      loading: false,
      drawn: false,
      chainData: undefined as ChainData | undefined,
      ref: null as HTMLCanvasElement | null,
    }))
    .actions(self => ({
      /**
       * #action
       */
      reload() {
        self.error = undefined
      },
      /**
       * #action
       * internal, a reference to a HTMLCanvas because we use a autorun to draw
       * the canvas
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
      },

      /**
       * #action
       */
      setColorScheme(s: { type: string }) {
        self.colorBy = cast(s)
      },

      /**
       * #action
       */
      setChainData(args: ChainData) {
        self.chainData = args
      },

      /**
       * #action
       */
      setDrawInter(f: boolean) {
        self.drawInter = f
      },

      /**
       * #action
       */
      setDrawLongRange(f: boolean) {
        self.drawLongRange = f
      },

      /**
       * #action
       */
      setLoading(f: boolean) {
        self.loading = f
      },

      /**
       * #action
       * used during tests to detect when we can complete a snapshot test
       */
      setDrawn(f: boolean) {
        self.drawn = f
      },

      /**
       * #action
       */
      setFilterBy(filter: Filter) {
        self.filterBy = cast(filter)
      },

      /**
       * #action
       * thin, bold, extrabold, etc
       */
      setLineWidth(n: number) {
        self.lineWidth = n
      },

      /**
       * #action
       * jitter val, helpful to jitter the x direction so you see better
       * evidence when e.g. 100 long reads map to same x position
       */
      setJitter(n: number) {
        self.jitter = n
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get lineWidthSetting() {
        return self.lineWidth ?? getConf(self, 'lineWidth')
      },

      /**
       * #getter
       */
      get jitterVal(): number {
        return self.jitter ?? getConf(self, 'jitter')
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self
      return {
        /**
         * #method
         * only used to tell system it's ready for export
         */
        renderProps() {
          return {
            ...superRenderProps(),
            notReady: !self.chainData,
            config: ConfigurationSchema('empty', {}).create(),
          }
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Filter by',
              icon: FilterListIcon,
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  FilterByTagDlg,
                  { model: self, handleClose },
                ])
              },
            },
            {
              label: 'Line width',
              subMenu: [
                {
                  label: 'Thin',
                  onClick: () => self.setLineWidth(1),
                },
                {
                  label: 'Bold',
                  onClick: () => self.setLineWidth(2),
                },
                {
                  label: 'Extra bold',
                  onClick: () => self.setLineWidth(5),
                },
              ],
            },
            {
              label: 'Jitter x-positions',
              subMenu: [
                {
                  type: 'checkbox',
                  checked: self.jitterVal === 0,
                  label: 'None',
                  onClick: () => self.setJitter(0),
                },
                {
                  type: 'checkbox',
                  checked: self.jitterVal === 2,
                  label: 'Small',
                  onClick: () => self.setJitter(2),
                },
                {
                  type: 'checkbox',
                  checked: self.jitterVal === 10,
                  label: 'Large',
                  onClick: () => self.setJitter(10),
                },
              ],
            },
            {
              label: 'Draw inter-region vertical lines',
              type: 'checkbox',
              checked: self.drawInter,
              onClick: () => self.setDrawInter(!self.drawInter),
            },
            {
              label: 'Draw long range connections',
              type: 'checkbox',
              checked: self.drawLongRange,
              onClick: () => self.setDrawLongRange(!self.drawLongRange),
            },
            {
              label: 'Color scheme',
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Insert size ± 3σ and orientation',
                  onClick: () =>
                    self.setColorScheme({ type: 'insertSizeAndOrientation' }),
                },
                {
                  label: 'Insert size ± 3σ',
                  onClick: () => self.setColorScheme({ type: 'insertSize' }),
                },
                {
                  label: 'Orientation',
                  onClick: () => self.setColorScheme({ type: 'orientation' }),
                },
                {
                  label: 'Insert size gradient',
                  onClick: () => self.setColorScheme({ type: 'gradient' }),
                },
              ],
            },
          ]
        },
      }
    })
    .views(self => ({
      /**
       * #method
       */
      async renderSvg(opts: {
        rasterizeLayers?: boolean
      }): Promise<React.ReactNode> {
        const { renderReadArcSvg } = await import('./renderSvg')
        return renderReadArcSvg(self as LinearReadArcsDisplayModel, opts)
      },
    }))
    .actions(self => ({
      afterAttach() {
        createAutorun(self, () => fetchChains(self), { delay: 1000 })

        createAutorun(self, async () => {
          const canvas = self.ref
          if (!canvas) {
            return
          }
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return
          }
          ctx.clearRect(0, 0, canvas.width, self.height * 2)
          ctx.resetTransform()
          ctx.scale(2, 2)
          drawFeats(self, ctx)
          self.setDrawn(true)
        })
      },
    }))
}

export type LinearReadArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadArcsDisplayModel =
  Instance<LinearReadArcsDisplayStateModel>

export default stateModelFactory
