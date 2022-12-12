import React, { lazy } from 'react'
import { autorun } from 'mobx'
import { addDisposer, cast, types, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  ConfigurationSchema,
  getConf,
} from '@jbrowse/core/configuration'
import { getSession, getContainingView } from '@jbrowse/core/util'

import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import PaletteIcon from '@mui/icons-material/Palette'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { FilterModel } from '../shared'
import drawFeats from './drawFeats'
import { fetchChains, ChainData } from '../shared/fetchChains'
import { ExportSvgOptions } from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView'

// async
const FilterByTagDlg = lazy(() => import('../shared/FilterByTag'))

interface Filter {
  flagInclude: number
  flagExclude: number
  readName?: string
  tagFilter?: { tag: string; value: string }
}

type LGV = LinearGenomeViewModel

/**
 * #stateModel LinearReadArcsDisplay
 * extends `BaseLinearDisplay`
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReadArcsDisplay',
      BaseLinearDisplay,
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
        colorBy: types.maybe(
          types.model({
            type: types.string,
            tag: types.maybe(types.string),
            extra: types.frozen(),
          }),
        ),

        drawInter: true,
      }),
    )
    .volatile(() => ({
      loading: false,
      drawn: false,
      chainData: undefined as ChainData | undefined,
      ref: null as HTMLCanvasElement | null,
      lastDrawnOffsetPx: 0,
    }))
    .actions(self => ({
      /**
       * #action
       * internal, a reference to a HTMLCanvas because we use a autorun to draw the canvas
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
       * allows the drawing to slide around a little bit if it takes a long time to refresh
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
    }))

    .views(self => {
      const {
        trackMenuItems: superTrackMenuItems,
        renderProps: superRenderProps,
      } = self

      return {
        /**
         * #getter
         */
        get lineWidthSetting() {
          return self.lineWidth ?? getConf(self, 'lineWidth')
        },
        /**
         * #getter
         */
        get ready() {
          return !!self.chainData
        },
        // we don't use a server side renderer, but we need to provide this
        // to avoid confusing the system currently
        get rendererTypeName() {
          return 'PileupRenderer'
        },
        // we don't use a server side renderer, so this fills in minimal
        // info so as not to crash
        renderProps() {
          return {
            ...superRenderProps(),
            // never ready, we don't want to use server side render
            notReady: true,
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
              label: 'Draw inter-region vertical lines',
              type: 'checkbox',
              checked: self.drawInter,
              onClick: () => self.setDrawInter(!self.drawInter),
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
      async renderSvg(opts: ExportSvgOptions) {
        const view = getContainingView(self) as LGV
        const width = view.dynamicBlocks.totalWidthPx
        const height = self.height
        let str
        if (opts.rasterizeLayers) {
          const canvas = document.createElement('canvas')
          canvas.width = width * 2
          canvas.height = height * 2
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            return
          }
          ctx.scale(2, 2)
          await drawFeats(self, ctx)
          str = (
            <image
              width={width}
              height={height}
              xlinkHref={canvas.toDataURL('image/png')}
            />
          )
        } else {
          // @ts-ignore
          const C2S = await import('canvas2svg')
          const ctx = new C2S.default(width, height)
          await drawFeats(self, ctx)
          str = (
            // eslint-disable-next-line react/no-danger
            <g dangerouslySetInnerHTML={{ __html: ctx.getSvg().innerHTML }} />
          )
        }

        return <g>{str}</g>
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => fetchChains(self), { delay: 1000 }),
        )

        addDisposer(
          self,
          autorun(
            async () => {
              try {
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
                await drawFeats(self, ctx)
                self.setDrawn(true)
              } catch (e) {
                console.error(e)
                self.setError(e)
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))
}

export type LinearReadArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadArcsDisplayModel =
  Instance<LinearReadArcsDisplayStateModel>

export default stateModelFactory
