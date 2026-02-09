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
      'MultiWebGLVariantDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        type: types.literal('MultiWebGLVariantDisplay'),
      }),
    )
    .volatile(() => ({
      webglCellData: undefined as VariantCellData | undefined,
    }))
    .views(self => ({
      get visibleRegions() {
        try {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized) {
            return []
          }
          const blocks = view.dynamicBlocks.contentBlocks
          if (blocks.length === 0) {
            return []
          }

          const bpPerPx = view.bpPerPx
          const regions: {
            refName: string
            regionNumber: number
            start: number
            end: number
            assemblyName: string
            screenStartPx: number
            screenEndPx: number
          }[] = []

          for (const block of blocks) {
            const blockScreenStart = block.offsetPx - view.offsetPx
            const blockScreenEnd = blockScreenStart + block.widthPx

            const clippedScreenStart = Math.max(0, blockScreenStart)
            const clippedScreenEnd = Math.min(view.width, blockScreenEnd)
            if (clippedScreenStart >= clippedScreenEnd) {
              continue
            }

            const bpStart =
              block.start + (clippedScreenStart - blockScreenStart) * bpPerPx
            const bpEnd =
              block.start + (clippedScreenEnd - blockScreenStart) * bpPerPx

            const blockRegionNumber = block.regionNumber ?? 0

            const prev = regions[regions.length - 1]
            if (prev?.regionNumber === blockRegionNumber) {
              prev.end = bpEnd
              prev.screenEndPx = clippedScreenEnd
            } else {
              regions.push({
                refName: block.refName,
                regionNumber: blockRegionNumber,
                start: bpStart,
                end: bpEnd,
                assemblyName: block.assemblyName,
                screenStartPx: clippedScreenStart,
                screenEndPx: clippedScreenEnd,
              })
            }
          }
          return regions
        } catch {
          return []
        }
      },
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
