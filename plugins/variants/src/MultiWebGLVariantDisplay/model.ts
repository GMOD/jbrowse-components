import { lazy } from 'react'

import { types } from '@jbrowse/mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel.ts'

import type { VariantCellData } from './components/computeVariantCells.ts'
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
    .volatile(() => ({
      webglCellData: undefined as VariantCellData | undefined,
    }))
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
      get webglCellDataMode() {
        return 'regular' as const
      },
      renderProps() {
        return { notReady: true }
      },
    }))
    .actions(self => ({
      setWebGLCellData(data: unknown) {
        self.webglCellData = data as VariantCellData | undefined
      },
    }))
}

export type MultiWebGLVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiWebGLVariantDisplayModel =
  Instance<MultiWebGLVariantDisplayStateModel>

export default stateModelFactory
