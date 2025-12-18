import type React from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import { LinearReadArcsDisplaySettingsMixin } from '../shared/LinearReadArcsDisplaySettingsMixin'
import { LinearReadDisplayBaseMixin } from '../shared/LinearReadDisplayBaseMixin'
import {
  getColorSchemeMenuItem,
  getFilterByMenuItem,
} from '../shared/menuItems'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearReadArcsDisplay
 * the arc display is a non-block-based track, so draws to a single canvas and
 * can connect multiple regions
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 * - [LinearReadArcsDisplaySettingsMixin](../linearreadarcdisplaysettingsmixin)
 */
function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReadArcsDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      FeatureDensityMixin(),
      LinearReadDisplayBaseMixin(),
      LinearReadArcsDisplaySettingsMixin(),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearReadArcsDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      /**
       * #volatile
       * ImageData returned from RPC rendering
       */
      renderingImageData: undefined as ImageBitmap | undefined,
      /**
       * #volatile
       * Stop token for the current rendering operation
       */
      renderingStopToken: undefined as StopToken | undefined,
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
      reload() {
        self.error = undefined
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
       * Set the rendering stop token
       */
      setRenderingStopToken(token?: StopToken) {
        self.renderingStopToken = token
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
            getFilterByMenuItem(self),
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
              label: 'Show...',
              type: 'subMenu',
              subMenu: [
                {
                  label:
                    'Inter-chromosomal connections (purple vertical lines)',
                  type: 'checkbox',
                  checked: self.drawInter,
                  onClick: () => {
                    self.setDrawInter(!self.drawInter)
                  },
                },
                {
                  label: 'Long range connections (red vertical lines)',
                  type: 'checkbox',
                  checked: self.drawLongRange,
                  onClick: () => {
                    self.setDrawLongRange(!self.drawLongRange)
                  },
                },
              ],
            },
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
          return renderSvg(self as LinearReadArcsDisplayModel, opts)
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

export type LinearReadArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadArcsDisplayModel =
  Instance<LinearReadArcsDisplayStateModel>

export default stateModelFactory
