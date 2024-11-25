import type React from 'react'
import { lazy } from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { getSession } from '@jbrowse/core/util'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import FilterListIcon from '@mui/icons-material/ClearAll'
import PaletteIcon from '@mui/icons-material/Palette'
import { types } from 'mobx-state-tree'

// locals
import type { ChainData } from '../shared/fetchChains'
import type { ColorBy, FilterBy } from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from 'mobx-state-tree'

// lazies
const FilterByTagDialog = lazy(
  () => import('../shared/components/FilterByTagDialog'),
)

/**
 * #stateModel LinearReadArcsDisplay
 * the arc display is a non-block-based track, so draws to a single canvas and
 * can connect multiple regions
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
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
        lineWidth: types.maybe(types.number),

        /**
         * #property
         */
        jitter: types.maybe(types.number),

        /**
         * #property
         */
        colorBySetting: types.frozen<ColorBy | undefined>(),

        /**
         * #property
         */
        filterBySetting: types.frozen<FilterBy | undefined>(),

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
      /**
       * #volatile
       */
      loading: false,
      /**
       * #volatile
       */
      chainData: undefined as ChainData | undefined,
      /**
       * #volatile
       */
      lastDrawnOffsetPx: undefined as number | undefined,
      /**
       * #volatile
       */
      lastDrawnBpPerPx: 0,
      /**
       * #volatile
       */
      ref: null as HTMLCanvasElement | null,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get colorBy() {
        return self.colorBySetting ?? getConf(self, 'colorBy')
      },
      /**
       * #getter
       */
      get filterBy() {
        return self.filterBySetting ?? getConf(self, 'filterBy')
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setLastDrawnOffsetPx(n: number) {
        self.lastDrawnOffsetPx = n
      },
      /**
       * #action
       */
      setLastDrawnBpPerPx(n: number) {
        self.lastDrawnBpPerPx = n
      },
      /**
       * #action
       */
      setLoading(f: boolean) {
        self.loading = f
      },

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
      setColorScheme(colorBy: { type: string }) {
        self.colorBySetting = {
          ...colorBy,
        }
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
      setFilterBy(filter: FilterBy) {
        self.filterBySetting = {
          ...filter,
        }
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
      get drawn() {
        return self.lastDrawnOffsetPx !== undefined
      },
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
                  FilterByTagDialog,
                  { model: self, handleClose },
                ])
              },
            },
            {
              label: 'Line width',
              subMenu: [
                {
                  label: 'Thin',
                  onClick: () => {
                    self.setLineWidth(1)
                  },
                },
                {
                  label: 'Bold',
                  onClick: () => {
                    self.setLineWidth(2)
                  },
                },
                {
                  label: 'Extra bold',
                  onClick: () => {
                    self.setLineWidth(5)
                  },
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
                  onClick: () => {
                    self.setJitter(0)
                  },
                },
                {
                  type: 'checkbox',
                  checked: self.jitterVal === 2,
                  label: 'Small',
                  onClick: () => {
                    self.setJitter(2)
                  },
                },
                {
                  type: 'checkbox',
                  checked: self.jitterVal === 10,
                  label: 'Large',
                  onClick: () => {
                    self.setJitter(10)
                  },
                },
              ],
            },
            {
              label: 'Draw inter-region vertical lines',
              type: 'checkbox',
              checked: self.drawInter,
              onClick: () => {
                self.setDrawInter(!self.drawInter)
              },
            },
            {
              label: 'Draw long range connections',
              type: 'checkbox',
              checked: self.drawLongRange,
              onClick: () => {
                self.setDrawLongRange(!self.drawLongRange)
              },
            },
            {
              label: 'Color scheme',
              icon: PaletteIcon,
              subMenu: [
                {
                  label: 'Insert size ± 3σ and orientation',
                  onClick: () => {
                    self.setColorScheme({ type: 'insertSizeAndOrientation' })
                  },
                },
                {
                  label: 'Insert size ± 3σ',
                  onClick: () => {
                    self.setColorScheme({ type: 'insertSize' })
                  },
                },
                {
                  label: 'Orientation',
                  onClick: () => {
                    self.setColorScheme({ type: 'orientation' })
                  },
                },
                {
                  label: 'Insert size gradient',
                  onClick: () => {
                    self.setColorScheme({ type: 'gradient' })
                  },
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
        const { renderSvg } = await import('../shared/renderSvgUtil')
        const { drawFeats } = await import('./drawFeats')
        return renderSvg(self as LinearReadArcsDisplayModel, opts, drawFeats)
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('../shared/afterAttach')
            const { drawFeats } = await import('./drawFeats')
            doAfterAttach(self, drawFeats)
          } catch (e) {
            console.error(e)
            self.setError(e)
          }
        })()
      },
    }))
}

export type LinearReadArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadArcsDisplayModel =
  Instance<LinearReadArcsDisplayStateModel>

export default stateModelFactory
