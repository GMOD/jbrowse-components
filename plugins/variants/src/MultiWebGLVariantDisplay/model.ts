import { lazy } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

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
    .views(self => {
      const { showSubmenuItems: superShowSubmenuItems } = self

      return {
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
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(
            self as MultiLinearVariantDisplayModel,
            opts,
          )
        },
        showSubmenuItems() {
          return [
            ...superShowSubmenuItems(),
            {
              label: 'Show reference alleles',
              helpText:
                'When this setting is off, the background is colored solid grey and only ALT alleles are colored on top of it. This makes it easier to see potentially overlapping structural variants',
              type: 'checkbox',
              checked: self.referenceDrawingMode !== 'skip',
              onClick: () => {
                self.setReferenceDrawingMode(
                  self.referenceDrawingMode === 'skip' ? 'draw' : 'skip',
                )
              },
            },
          ]
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
