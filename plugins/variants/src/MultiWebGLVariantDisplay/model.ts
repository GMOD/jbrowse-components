import { lazy } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel.ts'

import type { VariantCellData } from './components/computeVariantCells.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const WebGLVariantComponent = lazy(
  () => import('./components/WebGLVariantComponent.tsx'),
)

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'MultiLinearVariantDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        type: types.literal('MultiLinearVariantDisplay'),
      }),
    )
    .volatile(() => ({
      webglCellData: undefined as VariantCellData | undefined,
      webglCellDataLoading: false,
    }))
    .views(self => ({
      get visibleRegions() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return view.visibleRegions
      },
      get DisplayMessageComponent() {
        return WebGLVariantComponent
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
      setWebGLCellDataLoading(val: boolean) {
        self.webglCellDataLoading = val
      },
    }))
}

export type MultiLinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantDisplayModel =
  Instance<MultiLinearVariantDisplayStateModel>

export default stateModelFactory
