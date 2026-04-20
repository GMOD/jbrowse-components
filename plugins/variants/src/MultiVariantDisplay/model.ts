import { lazy } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

import type { VariantCellData } from './components/computeVariantCells.ts'
import type {
  VariantBackend,
  VariantRenderState,
} from './components/variantBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

const VariantComponent = lazy(() => import('./components/VariantComponent.tsx'))

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
          return VariantComponent
        },
        get cellDataMode() {
          return 'regular' as const
        },
        async renderSvg(opts?: ExportSvgDisplayOptions) {
          const { renderSvg } = await import('./renderSvg.tsx')
          return renderSvg(self, opts)
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
    .actions(self => ({
      startGpuBackendLifecycle(backend: VariantBackend) {
        self.installGpuDisplay<VariantBackend>(backend, {
          upload: b => {
            const cellData = self.cellData as
              | { perRegionCellData: Record<number, VariantCellData> }
              | undefined
            const active: number[] = []
            if (cellData) {
              for (const [k, v] of Object.entries(cellData.perRegionCellData)) {
                const n = Number(k)
                b.uploadRegion(n, v)
                active.push(n)
              }
            }
            b.pruneRegions(active)
          },
          render: b => {
            const view = getContainingView(self) as LinearGenomeViewModel
            if (!view.initialized) {
              return false
            }
            b.renderBlocks(self.renderBlocks, {
              canvasWidth: view.trackWidthPx,
              canvasHeight: self.availableHeight,
              rowHeight: self.rowHeight,
              scrollTop: self.scrollTop,
            })
            return true
          },
        })
      },
    }))
}

export type MultiLinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultiLinearVariantDisplayModel =
  Instance<MultiLinearVariantDisplayStateModel>

export default stateModelFactory
