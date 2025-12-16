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
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'
import {
  type ExportSvgDisplayOptions,
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import { chainToSimpleFeature } from '../LinearReadArcsDisplay/chainToSimpleFeature'
import { LinearReadDisplayBaseMixin } from '../shared/LinearReadDisplayBaseMixin'
import { LinearReadDisplayWithLayoutMixin } from '../shared/LinearReadDisplayWithLayoutMixin'
import { LinearReadDisplayWithPairFiltersMixin } from '../shared/LinearReadDisplayWithPairFiltersMixin'
import { SharedModificationsMixin } from '../shared/SharedModificationsMixin'
import { modificationData } from '../shared/modificationData'
import {
  getColorSchemeMenuItem,
  getFilterByMenuItem,
} from '../shared/menuItems'

import type { ReducedFeature } from '../shared/types'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const SetFeatureHeightDialog = lazy(
  () => import('./components/SetFeatureHeightDialog'),
)
const SetModificationThresholdDialog = lazy(
  () => import('../shared/components/SetModificationThresholdDialog'),
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
      SharedModificationsMixin(),
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
      /**
       * #volatile
       * ImageData returned from RPC rendering
       */
      renderingImageData: undefined as ImageBitmap | undefined,
      /**
       * #volatile
       * Chain ID of the currently selected feature for persistent highlighting
       */
      selectedFeatureId: undefined as string | undefined,
      /**
       * #volatile
       * Stop token for the current rendering operation
       */
      renderingStopToken: undefined as string | undefined,
    }))
    .views(self => ({
      get dataTestId() {
        return self.drawCloud ? 'cloud-canvas' : 'stack-canvas'
      },
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
      /**
       * #getter
       */
      get modificationThreshold() {
        return self.colorBy?.modifications?.threshold ?? 10
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
            'BaseFeatureWidget',
            'baseFeature',
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
      /**
       * #action
       * Set the rendering imageData from RPC
       */
      setRenderingImageData(imageData: ImageBitmap | undefined) {
        self.renderingImageData = imageData
      },
      /**
       * #action
       * Set the ID of the selected feature for persistent highlighting
       */
      setSelectedFeatureId(id: string | undefined) {
        self.selectedFeatureId = id
      },

      /**
       * #action
       * Set the rendering stop token
       */
      setRenderingStopToken(token: string | undefined) {
        self.renderingStopToken = token
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
            // We use RPC rendering, so we're always ready (data is fetched in RPC)
            notReady: false,
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
                  type: 'radio',
                  checked:
                    self.featureHeightSetting === 7 && self.noSpacing !== true,
                  onClick: () => {
                    self.setFeatureHeight(7)
                    self.setNoSpacing(false)
                  },
                },
                {
                  label: 'Compact',
                  type: 'radio',
                  checked:
                    self.featureHeightSetting === 3 && self.noSpacing === true,
                  onClick: () => {
                    self.setFeatureHeight(3)
                    self.setNoSpacing(true)
                  },
                },
                {
                  label: 'Super-compact',
                  type: 'radio',
                  checked:
                    self.featureHeightSetting === 1 && self.noSpacing === true,
                  onClick: () => {
                    self.setFeatureHeight(1)
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
              label: 'Toggle read cloud',
              type: 'checkbox',
              helpText:
                'In read cloud mode, the y-coordinate of the reads is proportional to TLEN (template length)',
              checked: self.drawCloud,
              onClick: () => {
                self.setDrawCloud(!self.drawCloud)
              },
            },
            {
              label: 'Draw singletons',
              type: 'checkbox',
              helpText:
                'If disabled, does not single parts of a paired end read, or a single long read alignment. Will only draw paired reads or split alignments',
              checked: self.drawSingletons,
              onClick: () => {
                self.setDrawSingletons(!self.drawSingletons)
              },
            },
            {
              label: 'Draw proper pairs',
              helpText:
                'If disabled, will not draw "normally paired" reads which can help highlight structural variants',
              type: 'checkbox',
              checked: self.drawProperPairs,
              onClick: () => {
                self.setDrawProperPairs(!self.drawProperPairs)
              },
            },
            {
              label: 'Draw read strand relative to primary',
              helpText:
                'This makes all the reads draw their strand relative to the primary alignment, which can be helpful in seeing patterns of flipping orientation in split long-read alignments',
              type: 'checkbox',
              checked: self.flipStrandLongReadChains,
              onClick: () => {
                self.setFlipStrandLongReadChains(!self.flipStrandLongReadChains)
              },
            },
            getFilterByMenuItem(self),
            getColorSchemeMenuItem(self),
          ]
        },

        /**
         * #method
         */
        async renderSvg(
          opts: ExportSvgDisplayOptions,
        ): Promise<React.ReactNode> {
          const { renderSvg } = await import('./renderSvg')
          return renderSvg(self as LinearReadCloudDisplayModel, opts)
        },
      }
    })
    .actions(self => ({
      beforeDestroy() {
        if (self.renderingStopToken) {
          stopStopToken(self.renderingStopToken)
        }
      },
    }))
    .actions(self => ({
      afterAttach() {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        ;(async () => {
          try {
            const { doAfterAttachRPC } = await import('./afterAttachRPC')
            doAfterAttachRPC(self)
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
