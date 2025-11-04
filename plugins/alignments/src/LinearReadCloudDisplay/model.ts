import type React from 'react'
import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
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

import { LinearReadDisplayBaseMixin } from '../shared/LinearReadDisplayBaseMixin'
import { LinearReadDisplayWithLayoutMixin } from '../shared/LinearReadDisplayWithLayoutMixin'
import { LinearReadDisplayWithPairFiltersMixin } from '../shared/LinearReadDisplayWithPairFiltersMixin'
import { chainToSimpleFeature } from '../shared/chainToSimpleFeature'
import {
  getColorSchemeMenuItem,
  getFilterByMenuItem,
} from '../shared/menuItems'

import type { ReducedFeature } from '../shared/fetchChains'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from 'mobx-state-tree'

// async
const SetFeatureHeightDialog = lazy(
  () => import('./components/SetFeatureHeightDialog'),
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
      LinearReadDisplayBaseMixin(),
      LinearReadDisplayWithLayoutMixin(),
      LinearReadDisplayWithPairFiltersMixin(),
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
        drawCloud: false,

        /**
         * #property
         * Whether to remove spacing between stacked features
         */
        noSpacing: types.maybe(types.boolean),

        /**
         * #property
         * Maximum height for the layout (prevents infinite stacking)
         */
        trackMaxHeight: types.maybe(types.number),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * Current height of the layout after drawing
       */
      layoutHeight: 0,
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
      reload() {
        self.error = undefined
      },
      /**
       * #action
       * Set whether to remove spacing between features
       */
      setNoSpacing(flag?: boolean) {
        self.noSpacing = flag
      },
      /**
       * #action
       * Set the maximum height for the layout
       */
      setMaxHeight(n?: number) {
        self.trackMaxHeight = n
      },
      /**
       * #action
       * Set the current layout height
       */
      setLayoutHeight(n: number) {
        self.layoutHeight = n
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
      /**
       * #action
       */
      setDrawCloud(b: boolean) {
        self.drawCloud = b
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
              subMenu: [
                {
                  label: 'Normal',
                  onClick: () => {
                    self.setFeatureHeight(7)
                    self.setNoSpacing(false)
                  },
                },
                {
                  label: 'Compact',
                  onClick: () => {
                    self.setFeatureHeight(3)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Manually set height...',
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
              ],
            },
            {
              label: 'Draw cloud (Y-coordinate as insert size)',
              type: 'checkbox',
              checked: self.drawCloud,
              onClick: () => {
                self.setDrawCloud(!self.drawCloud)
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
          if (self.drawCloud) {
            const { drawFeats } = await import('./drawFeatsCloud')
            return renderSvg(
              self as LinearReadCloudDisplayModel,
              opts,
              drawFeats,
            )
          } else {
            const { drawFeats } = await import('./drawFeatsStack')
            return renderSvg(
              self as LinearReadCloudDisplayModel,
              opts,
              drawFeats,
            )
          }
        },
      }
    })
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttach } = await import('../shared/afterAttach')
            const { drawFeats } = await import('./drawFeatsAbstract')
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
