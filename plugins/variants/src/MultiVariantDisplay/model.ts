import { lazy } from 'react'

import { getContainingView } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

import type {
  VariantRenderingBackend,
  VariantUploadData,
} from './components/variantRenderingBackendTypes.ts'
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
      MultiSampleVariantBaseModelF(configSchema, 'regular'),
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
        get renderState() {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (!view.initialized || self.cellData?.mode !== 'regular') {
            return undefined
          }
          return {
            canvasWidth: view.trackWidthPx,
            canvasHeight: self.availableHeight,
            rowHeight: self.rowHeight,
            scrollTop: self.scrollTop,
          }
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
    .views(self => ({
      // Map view of perRegionCellData for renderBlocks. Object.entries every
      // render is cheap (typical view shows 1-3 regions); MobX caches the
      // computed so only cellData changes invalidate it.
      get perRegionCellMap() {
        const { cellData } = self
        const out = new Map<number, VariantUploadData>()
        if (cellData?.mode === 'regular') {
          for (const k in cellData.perRegionCellData) {
            out.set(Number(k), cellData.perRegionCellData[k]!)
          }
        }
        return out
      },
      get flatbushIndices() {
        const { cellData } = self
        const out = new Map<number, Flatbush>()
        if (cellData?.mode === 'regular') {
          for (const k in cellData.perRegionCellData) {
            out.set(
              Number(k),
              Flatbush.from(cellData.perRegionCellData[k]!.flatbushData),
            )
          }
        }
        return out
      },
    }))
    .actions(self => ({
      startRenderingBackend(backend: VariantRenderingBackend) {
        self.attachRenderingBackend<VariantRenderingBackend>(backend, {
          upload: b => {
            const active: number[] = []
            for (const [n, v] of self.perRegionCellMap) {
              b.uploadRegion(n, v)
              active.push(n)
            }
            b.pruneRegions(active)
          },
          render: b => {
            const state = self.renderState
            if (!state) {
              return false
            }
            b.renderBlocks(self.renderBlocks, self.perRegionCellMap, state)
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
