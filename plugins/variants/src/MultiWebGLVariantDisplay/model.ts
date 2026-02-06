import { lazy } from 'react'

import { types } from '@jbrowse/mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const WebGLVariantComponent = lazy(
  () => import('./components/WebGLVariantComponent.tsx'),
)

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'MultiWebGLVariantDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        type: types.literal('MultiWebGLVariantDisplay'),
      }),
    )
    .views(() => ({
      get DisplayMessageComponent() {
        return WebGLVariantComponent
      },
      get rendererTypeName() {
        return 'MultiVariantRenderer'
      },
      get featureWidgetType() {
        return {
          type: 'VariantFeatureWidget',
          id: 'variantFeature',
        }
      },
      renderProps() {
        return { notReady: true }
      },
    }))
}

export type MultiWebGLVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiWebGLVariantDisplayModel =
  Instance<MultiWebGLVariantDisplayStateModel>

export default stateModelFactory
