import type React from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

import { LinearReadDisplayBaseMixin } from '../shared/LinearReadDisplayBaseMixin'
import {
  getColorSchemeMenuItem,
  getFilterByMenuItem,
} from '../shared/menuItems'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from 'mobx-state-tree'

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
      LinearReadDisplayBaseMixin(),
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
         * Width of the arc lines (thin, bold, extra bold)
         */
        lineWidth: types.maybe(types.number),

        /**
         * #property
         * Jitter amount for x-position to better visualize overlapping arcs
         */
        jitter: types.maybe(types.number),

        /**
         * #property
         * Whether to draw inter-region vertical lines
         */
        drawInter: true,

        /**
         * #property
         * Whether to draw long-range connections
         */
        drawLongRange: true,
      }),
    )
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
       * Toggle drawing of inter-region vertical lines
       */
      setDrawInter(f: boolean) {
        self.drawInter = f
      },

      /**
       * #action
       * Toggle drawing of long-range connections
       */
      setDrawLongRange(f: boolean) {
        self.drawLongRange = f
      },

      /**
       * #action
       * Set the line width (thin=1, bold=2, extrabold=5, etc)
       */
      setLineWidth(n: number) {
        self.lineWidth = n
      },

      /**
       * #action
       * Set jitter amount for x-position
       * Helpful to jitter the x direction so you see better evidence
       * when e.g. 100 long reads map to same x position
       */
      setJitter(n: number) {
        self.jitter = n
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get lineWidthSetting() {
        return self.lineWidth ?? getConf(self, 'lineWidth')
      },

      /**
       * #getter
       */
      get jitterVal(): number {
        return self.jitter ?? getConf(self, 'jitter')
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
              label: 'Draw inter-region vertical lines',
              type: 'checkbox',
              checked: self.drawInter,
              onClick: () => {
                self.setDrawInter(!self.drawInter)
              },
            },
            {
              label: 'Draw long range connections',
              type: 'checkbox',
              checked: self.drawLongRange,
              onClick: () => {
                self.setDrawLongRange(!self.drawLongRange)
              },
            },
            getColorSchemeMenuItem(self),
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
        const { renderSvg } = await import('../shared/renderSvgUtil')
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
