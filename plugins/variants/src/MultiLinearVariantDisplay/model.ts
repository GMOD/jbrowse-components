import { getSession } from '@jbrowse/core/util'
import { isAlive, types } from 'mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'
import type { Instance } from 'mobx-state-tree'

/**
 * #stateModel MultiLinearVariantDisplay
 * extends
 * - [MultiVariantBaseModel](../linearbaredisplay)
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'MultiLinearVariantDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('MultiLinearVariantDisplay'),

        /**
         * #property
         * used only if autoHeight is false
         */
        rowHeightSetting: types.optional(types.number, 11),

        /**
         * #property
         * adjust to height of track/display
         */
        autoHeight: false,
      }),
    )
    .actions(self => ({
      /**
       * #action
       */
      setRowHeight(arg: number) {
        self.rowHeightSetting = arg
      },
      /**
       * #action
       */
      setAutoHeight(arg: boolean) {
        self.autoHeight = arg
      },
    }))

    .views(self => ({
      /**
       * #getter
       */
      get rendererTypeName() {
        return 'MultiVariantRenderer'
      },
      /**
       * #getter
       */
      get rowHeight() {
        const { autoHeight, sources, rowHeightSetting, height } = self
        return autoHeight ? height / (sources?.length || 1) : rowHeightSetting
      },
    }))
    .views(self => {
      return {
        get canDisplayLabels() {
          return self.rowHeight > 8
        },
        /**
         * #getter
         */
        get totalHeight() {
          return self.rowHeight * (self.sources?.length || 1)
        },
      }
    })

    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
            {
              label: 'Adjust to height of display?',
              type: 'checkbox',
              checked: self.autoHeight,
              onClick: () => {
                self.setAutoHeight(!self.autoHeight)
              },
            },
          ]
        },

        renderProps() {
          const superProps = self.adapterProps()
          return {
            ...superProps,
            notReady: superProps.notReady || !self.sources,
            displayModel: self,
            rpcDriverName: self.rpcDriverName,
            height: self.height,
            totalHeight: self.totalHeight,
            rowHeight: self.rowHeight,
            sources: self.sources,
            scrollTop: self.scrollTop,
          }
        },
      }
    })
    .actions(self => {
      const { renderSvg: superRenderSvg } = self
      return {
        afterAttach() {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          ;(async () => {
            try {
              const { getMultiVariantSourcesAutorun } = await import(
                '../getMultiVariantSourcesAutorun'
              )
              getMultiVariantSourcesAutorun(self)
            } catch (e) {
              if (isAlive(self)) {
                console.error(e)
                getSession(self).notifyError(`${e}`, e)
              }
            }
          })()
        },

        /**
         * #action
         */
        async renderSvg(opts: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg')
          return renderSvg(self, opts, superRenderSvg)
        },
      }
    })
}

export type MultiLinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantDisplayModel =
  Instance<MultiLinearVariantDisplayStateModel>

export default stateModelFactory
