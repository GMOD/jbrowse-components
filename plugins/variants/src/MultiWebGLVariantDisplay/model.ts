import { lazy } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

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
      MultiSampleVariantBaseModelF(configSchema),
      types.model({
        type: types.literal('MultiLinearVariantDisplay'),
      }),
    )
    .views(self => ({
      get visibleRegions() {
        const view = getContainingView(self) as LinearGenomeViewModel
        return view.visibleRegions
      },
      get DisplayMessageComponent() {
        return WebGLVariantComponent
      },
      get webglCellDataMode() {
        return 'regular' as const
      },
      renderProps() {
        return { notReady: true }
      },
    }))
}

export type MultiLinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantDisplayModel =
  Instance<MultiLinearVariantDisplayStateModel>

export default stateModelFactory
