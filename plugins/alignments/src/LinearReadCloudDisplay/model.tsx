import React, { lazy } from 'react'
import { autorun } from 'mobx'
import { addDisposer, cast, types, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'

// icons
import PaletteIcon from '@mui/icons-material/Palette'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { FilterModel } from '../shared'
import { fetchChains, ChainData } from '../shared/fetchChains'
import drawFeats from './drawFeats'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// async
const FilterByTagDlg = lazy(() => import('../shared/FilterByTag'))

interface Filter {
  flagInclude: number
  flagExclude: number
  readName?: string
  tagFilter?: { tag: string; value: string }
}

// stabilize clipid under test for snapshot
function getId(id: string) {
  const isJest = typeof jest === 'undefined'
  return `cloud-clip-${isJest ? id : 'jest'}`
}

/**
 * #stateModel LinearReadCloudDisplay
 * extends `BaseLinearDisplay`
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReadCloudDisplay',
      BaseLinearDisplay,
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
        filterBy: types.optional(FilterModel, {}),

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
      reload() {
        self.error = undefined
      },
      /**
       * #action
       */
      setRef(ref: HTMLCanvasElement | null) {
        self.ref = ref
      },

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
      setLoading(f: boolean) {
        self.loading = f
      },

      /**
       * #action
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
       */
      setLastDrawnOffsetPx(n: number) {
        self.lastDrawnOffsetPx = n
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

        /**
         * #method
         */
        async renderSvg(opts: { rasterizeLayers?: boolean }) {
          const view = getContainingView(self) as LinearGenomeViewModel
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
            const clipid = getId(self.id)
            str = (
              <>
                <defs>
                  <clipPath id={clipid}>
                    <rect x={0} y={0} width={width} height={height} />
                  </clipPath>
                </defs>
                <g
                  /* eslint-disable-next-line react/no-danger */
                  dangerouslySetInnerHTML={{
                    __html: ctx.getSvg().innerHTML,
                  }}
                  clipPath={`url(#${clipid})`}
                />
              </>
            )
          }

          return <g>{str}</g>
        },
      }
    })
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

export type LinearReadCloudDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadCloudDisplayModel =
  Instance<LinearReadCloudDisplayStateModel>

export default stateModelFactory
