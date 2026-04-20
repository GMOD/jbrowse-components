import { lazy } from 'react'

import { clamp, getContainingView } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

import type { MatrixCellData } from './components/computeVariantMatrixCells.ts'
import type { VariantMatrixBackend } from './components/variantMatrixBackendTypes.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

const VariantMatrixComponent = lazy(
  () => import('./components/VariantMatrixComponent.tsx'),
)

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      MultiSampleVariantBaseModelF(configSchema),
      types.model({
        type: types.literal('LinearVariantMatrixDisplay'),
        lineZoneHeight: types.optional(types.number, 20),
      }),
    )
    .views(self => ({
      get DisplayMessageComponent() {
        return VariantMatrixComponent
      },
      get blockType() {
        return 'dynamicBlocks'
      },
      get prefersOffset() {
        return true
      },
      get cellDataMode() {
        return 'matrix' as const
      },
      /**
       * #getter
       * Per-frame render state for the GPU backend — the autorun reads this
       * every time any tracked observable (cellData, scrollTop, rowHeight,
       * canvas width, …) changes.
       */
      get renderState() {
        const view = getContainingView(self) as LinearGenomeViewModel
        const cellData = self.cellData as MatrixCellData | undefined
        if (!cellData) {
          return undefined
        }
        return {
          canvasWidth: Math.round(
            view.dynamicBlocks.totalWidthPxWithoutBorders,
          ),
          canvasHeight: self.availableHeight,
          rowHeight: self.rowHeight,
          scrollTop: self.scrollTop,
        }
      },
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self, opts)
      },
    }))
    .actions(self => ({
      setLineZoneHeight(n: number) {
        self.lineZoneHeight = clamp(n, 10, 1000)
        return self.lineZoneHeight
      },
      /**
       * #action
       */
      startGpuBackendLifecycle(backend: VariantMatrixBackend) {
        self.installGpuDisplay<VariantMatrixBackend>(backend, {
          upload: b => {
            const data = self.cellData as MatrixCellData | undefined
            if (data) {
              b.uploadCellData(data)
            }
          },
          render: b => {
            const state = self.renderState
            if (!state) {
              return false
            }
            b.render(state)
            return true
          },
        })
      },
    }))
    .postProcessSnapshot(snap => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!snap) {
        return snap
      }
      const { lineZoneHeight, ...rest } = snap as Omit<typeof snap, symbol>
      return {
        ...rest,
        ...(lineZoneHeight !== 20 ? { lineZoneHeight } : {}),
      } as typeof snap
    })
}

export type LinearVariantMatrixDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantMatrixDisplayModel =
  Instance<LinearVariantMatrixDisplayStateModel>
