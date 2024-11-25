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

// async
const FilterByTagDialog = lazy(
  () => import('../shared/components/FilterByTagDialog'),
)

/**
 * #stateModel LinearReadCloudDisplay
 * it is not a block based track, hence not BaseLinearDisplay
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReadCloudDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearReadCloudDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        filterBySetting: types.frozen<FilterBy | undefined>(),

        /**
         * #property
         */
        colorBySetting: types.frozen<ColorBy | undefined>(),

        /**
         * #property
         */
        drawSingletons: true,
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
      setDrawSingletons(f: boolean) {
        self.drawSingletons = f
      },
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
      setFilterBy(filter: FilterBy) {
        self.filterBySetting = {
          ...filter,
        }
      },
    }))
    .views(self => ({
      get drawn() {
        return self.lastDrawnOffsetPx !== undefined
      },
    }))
    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        // we don't use a server side renderer, so this fills in minimal
        // info so as not to crash
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
              label: 'Draw singletons',
              type: 'checkbox',
              checked: self.drawSingletons,
              onClick: () => {
                self.setDrawSingletons(!self.drawSingletons)
              },
            },
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

        /**
         * #method
         */
        async renderSvg(opts: {
          rasterizeLayers?: boolean
        }): Promise<React.ReactNode> {
          const { renderSvg } = await import('../shared/renderSvgUtil')
          const { drawFeats } = await import('./drawFeats')
          return renderSvg(self as LinearReadCloudDisplayModel, opts, drawFeats)
        },
      }
    })
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

export type LinearReadCloudDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadCloudDisplayModel =
  Instance<LinearReadCloudDisplayStateModel>

export default stateModelFactory
