import React, { lazy } from 'react'
import { cast, types, Instance } from 'mobx-state-tree'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
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
        drawSingletons: true,

        /**
         * #property
         */
        filterBy: types.optional(FilterModel, {}),

        /**
         * #property
         */
        type: types.literal('LinearReadCloudDisplay'),
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

      setColorScheme(s: { type: string }) {
        self.colorBy = cast(s)
      },

      /**
       * #action
       */
      setDrawSingletons(f: boolean) {
        self.drawSingletons = f
      },

      /**
       * #action
       */
      setFilterBy(filter: IFilter) {
        self.filterBy = cast(filter)
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
        async renderSvg(opts: {
          rasterizeLayers?: boolean
        }): Promise<React.ReactNode> {
          const { renderSvg } = await import('../shared/renderSvg')
          const { drawFeats } = await import('./drawFeats')
          return renderSvg(self as LinearReadCloudDisplayModel, opts, drawFeats)
        },

        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              checked: self.drawSingletons,
              label: 'Draw singletons',
              onClick: () => self.setDrawSingletons(!self.drawSingletons),
              type: 'checkbox',
            },
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
