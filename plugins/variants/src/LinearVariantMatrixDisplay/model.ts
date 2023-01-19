import { ConfigurationReference } from '@jbrowse/core/configuration'

import { linearBasicDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { Instance, types } from 'mobx-state-tree'

// locals
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearVariantMatrixDisplay
 * extends `LinearBasicDisplay`
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      linearBasicDisplayModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearVariantMatrixDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      samples: undefined as string[] | undefined,
    }))
    .views(() => ({
      /**
       * #getter
       */
      get blockType() {
        return 'dynamicBlocks'
      },
      /**
       * #getter
       */
      get renderDelay() {
        return 1000
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setSamples(arg: string[]) {
        self.samples = arg
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          const superProps = superRenderProps()
          return {
            ...superProps,
            height: self.height,
          }
        },
      }
    })
}

export type LinearVariantMatrixDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantMatrixDisplayModel =
  Instance<LinearVariantMatrixDisplayStateModel>
