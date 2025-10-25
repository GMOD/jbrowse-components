import type React from 'react'
import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  SimpleFeature,
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

import {
  getColorSchemeMenuItem,
  getFilterByMenuItem,
} from '../shared/menuItems'

import type { ChainData, ReducedFeature } from '../shared/fetchChains'
import type { ColorBy, FilterBy } from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { Instance } from 'mobx-state-tree'

// async
const SetFeatureHeightDialog = lazy(
  () => import('./components/SetFeatureHeightDialog'),
)

/**
 * Helper function to convert a chain of ReducedFeatures into a SimpleFeature
 * with subfeatures representing each part of the chain
 */
function chainToSimpleFeature(chain: ReducedFeature[]) {
  if (chain.length === 0) {
    throw new Error('Chain cannot be empty')
  }

  const firstFeat = chain[0]!

  // Create a synthetic feature that encompasses the entire chain
  const syntheticFeature = new SimpleFeature({
    uniqueId: firstFeat.id,
    id: firstFeat.id,
    name: firstFeat.name,
    refName: firstFeat.refName,
    start: Math.min(...chain.map(f => f.start)),
    end: Math.max(...chain.map(f => f.end)),
    strand: firstFeat.strand,
    flags: firstFeat.flags,
    tlen: firstFeat.tlen,
    pair_orientation: firstFeat.pair_orientation,
    clipPos: firstFeat.clipPos,
    ...(firstFeat.next_ref && { next_ref: firstFeat.next_ref }),
    ...(firstFeat.next_pos !== undefined && { next_pos: firstFeat.next_pos }),
    ...(firstFeat.SA && { SA: firstFeat.SA }),
    // Add subfeatures for each part of the chain
    subfeatures: chain.map((feat, idx) => ({
      uniqueId: `${feat.id}_${idx}`,
      id: `${feat.id}_${idx}`,
      name: feat.name,
      refName: feat.refName,
      start: feat.start,
      end: feat.end,
      strand: feat.strand,
      type: 'alignment_part',
      flags: feat.flags,
      tlen: feat.tlen,
      pair_orientation: feat.pair_orientation,
      clipPos: feat.clipPos,
      ...(feat.next_ref && { next_ref: feat.next_ref }),
      ...(feat.next_pos !== undefined && { next_pos: feat.next_pos }),
      ...(feat.SA && { SA: feat.SA }),
    })),
  })

  return syntheticFeature
}

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

        /**
         * #property
         */
        drawProperPairs: true,

        /**
         * #property
         */
        featureHeight: types.maybe(types.number),
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
      /**
       * #volatile
       */
      featureLayout: undefined as Flatbush | undefined,
      /**
       * #volatile
       */
      mouseoverRef: null as HTMLCanvasElement | null,
      /**
       * #volatile
       */
      featuresForFlatbush: [] as {
        x1: number
        y1: number
        x2: number
        y2: number
        data: ReducedFeature
        chainId: string
        chainMinX: number
        chainMaxX: number
        chain: ReducedFeature[]
      }[],
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
      /**
       * #getter
       */
      get featureHeightSetting() {
        return self.featureHeight ?? getConf(self, 'featureHeight')
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
      setDrawProperPairs(f: boolean) {
        self.drawProperPairs = f
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
      /**
       * #action
       */
      setFeatureLayout(layout: Flatbush) {
        self.featureLayout = layout
      },
      /**
       * #action
       */
      setMouseoverRef(ref: HTMLCanvasElement | null) {
        self.mouseoverRef = ref
      },
      /**
       * #action
       */
      setFeaturesForFlatbush(
        features: {
          x1: number
          y1: number
          x2: number
          y2: number
          data: ReducedFeature
          chainId: string
          chainMinX: number
          chainMaxX: number
          chain: ReducedFeature[]
        }[],
      ) {
        self.featuresForFlatbush = features
      },
      /**
       * #action
       */
      setFeatureHeight(n?: number) {
        self.featureHeight = n
      },
      /**
       * #action
       */
      selectFeature(chain: ReducedFeature[]) {
        const session = getSession(self)
        const syntheticFeature = chainToSimpleFeature(chain)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'AlignmentsFeatureWidget',
            'alignmentFeature',
            {
              featureData: syntheticFeature.toJSON(),
              view: getContainingView(self),
              track: getContainingTrack(self),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(syntheticFeature)
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
              label: 'Set feature height...',
              onClick: () => {
                getSession(self).queueDialog(handleClose => [
                  SetFeatureHeightDialog,
                  {
                    model: self,
                    handleClose,
                  },
                ])
              },
            },
            {
              label: 'Draw singletons',
              type: 'checkbox',
              checked: self.drawSingletons,
              onClick: () => {
                self.setDrawSingletons(!self.drawSingletons)
              },
            },
            {
              label: 'Draw proper pairs',
              type: 'checkbox',
              checked: self.drawProperPairs,
              onClick: () => {
                self.setDrawProperPairs(!self.drawProperPairs)
              },
            },
            getFilterByMenuItem(self),
            getColorSchemeMenuItem(self),
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
