import React, { lazy } from 'react'
import { cast, types, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import PaletteIcon from '@mui/icons-material/Palette'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { FilterModel, IFilter } from '../shared'
import { ChainData } from '../shared/fetchChains'

// async
const FilterByTagDialog = lazy(() => import('../shared/FilterByTag'))

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
        colorBy: types.maybe(
          types.model({
            extra: types.frozen(),
            tag: types.maybe(types.string),
            type: types.string,
          }),
        ),

        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        drawInter: true,

        /**
         * #property
         */
        drawLongRange: true,

        /**
         * #property
         */
        filterBy: types.optional(FilterModel, {}),

        /**
         * #property
         */
        jitter: types.maybe(types.number),

        /**
         * #property
         */
        lineWidth: types.maybe(types.number),

        /**
         * #property
         */
        type: types.literal('LinearReadArcsDisplay'),
      }),
    )
    .volatile(() => ({
      chainData: undefined as ChainData | undefined,
      lastDrawnBpPerPx: 0,
      lastDrawnOffsetPx: undefined as number | undefined,
      loading: false,
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
       */
      setChainData(args: ChainData) {
        self.chainData = args
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
      setFilterBy(filter: IFilter) {
        self.filterBy = cast(filter)
      },

      /**
       * #action
       * jitter val, helpful to jitter the x direction so you see better
       * evidence when e.g. 100 long reads map to same x position
       */
      setJitter(n: number) {
        self.jitter = n
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
      setLastDrawnOffsetPx(n: number) {
        self.lastDrawnOffsetPx = n
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
       */
      setLoading(f: boolean) {
        self.loading = f
      },

      /**
       * #action
       * internal, a reference to a HTMLCanvas because we use a autorun to draw
       * the canvas
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
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
      get jitterVal(): number {
        return self.jitter ?? getConf(self, 'jitter')
      },

      /**
       * #getter
       */
      get lineWidthSetting() {
        return self.lineWidth ?? getConf(self, 'lineWidth')
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
              icon: FilterListIcon,
              label: 'Filter by',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  FilterByTagDialog,
                  { handleClose, model: self },
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
                  checked: self.jitterVal === 0,
                  label: 'None',
                  onClick: () => self.setJitter(0),
                  type: 'checkbox',
                },
                {
                  checked: self.jitterVal === 2,
                  label: 'Small',
                  onClick: () => self.setJitter(2),
                  type: 'checkbox',
                },
                {
                  checked: self.jitterVal === 10,
                  label: 'Large',
                  onClick: () => self.setJitter(10),
                  type: 'checkbox',
                },
              ],
            },
            {
              checked: self.drawInter,
              label: 'Draw inter-region vertical lines',
              onClick: () => self.setDrawInter(!self.drawInter),
              type: 'checkbox',
            },
            {
              checked: self.drawLongRange,
              label: 'Draw long range connections',
              onClick: () => self.setDrawLongRange(!self.drawLongRange),
              type: 'checkbox',
            },
            {
              icon: PaletteIcon,
              label: 'Color scheme',
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
        const { renderSvg } = await import('../shared/renderSvg')
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
