import React, { lazy } from 'react'
import { autorun } from 'mobx'
import { addDisposer, cast, types, Instance } from 'mobx-state-tree'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import {
  getSession,
  getContainingView,
  getContainingTrack,
} from '@jbrowse/core/util'

import {
  LinearGenomeViewModel,
  BaseLinearDisplay,
} from '@jbrowse/plugin-linear-genome-view'

// icons
import PaletteIcon from '@mui/icons-material/Palette'
import FilterListIcon from '@mui/icons-material/ClearAll'

// locals
import { FilterModel } from '../shared'
import { orientationTypes } from '../util'

// async
const FilterByTagDlg = lazy(() => import('../shared/FilterByTag'))

type LGV = LinearGenomeViewModel

interface Filter {
  flagInclude: number
  flagExclude: number
  readName?: string
  tagFilter?: { tag: string; value: string }
}
interface ReducedFeature {
  name: string
  refName: string
  start: number
  end: number
  id: string
  flags: number
  tlen: number
  pair_orientation: string
}
interface PairStats {
  max: number
  min: number
  upper: number
  lower: number
}

type PairMap = { [key: string]: ReducedFeature[] }

interface PairedData {
  pairedFeatures: PairMap
  stats: PairStats
}

async function fetchFeatures(self: LinearAlignmentsArcsDisplayModel) {
  try {
    const { rpcSessionId: sessionId } = getContainingTrack(self)
    const { rpcManager } = getSession(self)
    const view = getContainingView(self) as LGV

    if (!view.initialized) {
      return
    }
    self.setLoading(true)

    const ret = (await rpcManager.call(sessionId, 'PileupGetFeatures', {
      sessionId,
      regions: view.staticBlocks.contentBlocks,
      adapterConfig: self.adapterConfig,
    })) as PairedData

    self.setPairedData(ret)
    self.setLoading(false)
  } catch (e) {
    console.error(e)
    self.setError(e)
  }
}

const height = 1200

const alignmentColoring: { [key: string]: string } = {
  color_pair_lr: '#c8c8c8',
  color_pair_rr: 'navy',
  color_pair_rl: 'teal',
  color_pair_ll: 'green',
}

function getInsertSizeColor(
  f1: { pair_orientation: string; refName: string; tlen: number },
  f2: { pair_orientation: string; refName: string; tlen: number },
  stats: PairStats,
) {
  const sameRef = f1.refName === f2.refName
  const tlen = Math.abs(f1.tlen)
  if (sameRef && tlen > (stats?.upper || 0)) {
    return 'red'
  } else if (sameRef && tlen < (stats?.lower || 0)) {
    return 'pink'
  } else if (!sameRef) {
    return 'purple'
  }
  return ''
}

function getInsertSizeAndOrientationColor(
  f1: { pair_orientation: string; refName: string; tlen: number },
  f2: { pair_orientation: string; refName: string; tlen: number },
  stats: PairStats,
) {
  return getInsertSizeColor(f1, f2, stats) || getOrientationColor(f1)
}

function getOrientationColor(f: { pair_orientation: string }) {
  const type = orientationTypes['fr']
  const orientation = type[f.pair_orientation]
  const map = {
    LR: 'color_pair_lr',
    RR: 'color_pair_rr',
    RL: 'color_pair_rl',
    LL: 'color_pair_ll',
  }
  const val = map[orientation as keyof typeof map]
  return alignmentColoring[val] || 'grey'
}

async function drawFeats(self: LinearAlignmentsArcsDisplayModel) {
  try {
    const { pairedData, ref } = self
    if (!pairedData) {
      return
    }
    const view = getContainingView(self) as LGV
    const canvas = ref
    if (!canvas) {
      return
    }
    const width = canvas.getBoundingClientRect().width * 2
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    self.setLastDrawnOffsetPx(view.offsetPx)
    canvas.width = width
    ctx.clearRect(0, 0, width, height)
    ctx.scale(2, 2)
    const { pairedFeatures, stats } = pairedData
    Object.values(pairedFeatures)
      .filter(val => val.length === 2)
      .forEach(val => {
        const [v0, v1] = val
        const s = Math.min(v0.start, v1.start)
        const e = Math.max(v0.end, v1.end)
        const r1 = view.bpToPx({ refName: v0.refName, coord: s })
        const r2 = view.bpToPx({ refName: v0.refName, coord: e })

        if (!r1 || !r2) {
          return
        }
        const radius = (r2.offsetPx - r1.offsetPx) / 2
        const absrad = Math.abs(radius)
        const p = r1.offsetPx - view.offsetPx
        ctx.moveTo(p, 0)
        ctx.beginPath()
        const type = self.colorBy?.type || 'insertSizeAndOrientation'

        if (type === 'insertSizeAndOrientation') {
          ctx.strokeStyle = getInsertSizeAndOrientationColor(v0, v1, stats)
        } else if (type === 'orientation') {
          ctx.strokeStyle = getOrientationColor(v0)
        } else if (type === 'insertSize') {
          ctx.strokeStyle = getInsertSizeColor(v0, v1, stats) || 'grey'
        } else if (type === 'gradient') {
          ctx.strokeStyle = `hsl(${Math.log10(Math.abs(e - s)) * 10},50%,50%)`
        }

        ctx.arc(p + radius, 0, absrad, 0, Math.PI)
        ctx.stroke()
      })
  } catch (e) {
    console.error(e)
    self.setError(e)
  }
}

/**
 * #stateModel LinearAlignmentsArcsDisplay
 * extends `BaseLinearDisplay`
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearAlignmentsArcsDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearAlignmentsArcsDisplay'),
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
      pairedData: undefined as PairedData | undefined,
      ref: null as HTMLCanvasElement | null,
      lastDrawnOffsetPx: 0,
    }))
    .actions(self => ({
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
      setPairedData(args: PairedData) {
        self.pairedData = args
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
        renderSvg() {
          return <></>
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => fetchFeatures(self), { delay: 1000 }),
        )

        addDisposer(
          self,
          autorun(() => drawFeats(self), { delay: 1000 }),
        )
      },
    }))
}

export type LinearAlignmentsArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearAlignmentsArcsDisplayModel =
  Instance<LinearAlignmentsArcsDisplayStateModel>

export default stateModelFactory
