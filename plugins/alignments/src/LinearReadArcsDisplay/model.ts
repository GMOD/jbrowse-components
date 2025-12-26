import type React from 'react'

import { ConfigurationReference } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'
import {
  FeatureDensityMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'

import { LinearReadArcsDisplaySettingsMixin } from '../shared/LinearReadArcsDisplaySettingsMixin'
import { LinearReadDisplayBaseMixin } from '../shared/LinearReadDisplayBaseMixin'
import { RPCRenderingMixin } from '../shared/RPCRenderingMixin'
import { getReadDisplayLegendItems } from '../shared/legendUtils'
import {
  getColorSchemeMenuItem,
  getFilterByMenuItem,
} from '../shared/menuItems'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LegendItem,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * #stateModel LinearReadArcsDisplay
 * the arc display is a non-block-based track, so draws to a single canvas and
 * can connect multiple regions
 * extends
 * - [BaseDisplay](../basedisplay)
 * - [TrackHeightMixin](../trackheightmixin)
 * - [FeatureDensityMixin](../featuredensitymixin)
 * - [LinearReadArcsDisplaySettingsMixin](../linearreadarcdisplaysettingsmixin)
 * - [RPCRenderingMixin](../rpcrenderingmixin)
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
      RPCRenderingMixin(),
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
        showLegend: types.maybe(types.boolean),
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      setShowLegend(s: boolean) {
        self.showLegend = s
      },
    }))
    .views(self => ({
      /**
       * #method
       * Returns legend items based on current colorBy setting
       */
      legendItems(): LegendItem[] {
        return getReadDisplayLegendItems(self.colorBy)
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
         */
        renderProps() {
          return {
            ...superRenderProps(),
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
                  label: 'Show legend',
                  type: 'checkbox',
                  checked: self.showLegend,
                  onClick: () => {
                    self.setShowLegend(!self.showLegend)
                  },
                },
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
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const {
        lineWidth,
        jitter,
        drawInter,
        drawLongRange,
        showLegend,
        ...rest
      } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(lineWidth !== undefined ? { lineWidth } : {}),
        ...(jitter !== undefined ? { jitter } : {}),
        ...(!drawInter ? { drawInter } : {}),
        ...(!drawLongRange ? { drawLongRange } : {}),
        ...(showLegend !== undefined ? { showLegend } : {}),
      } as typeof snap
    })
}

export type LinearReadArcsDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearReadArcsDisplayModel =
  Instance<LinearReadArcsDisplayStateModel>

export default stateModelFactory
