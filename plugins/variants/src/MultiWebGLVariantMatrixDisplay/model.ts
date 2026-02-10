import { lazy } from 'react'

import { clamp } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiVariantBaseModelF from '../shared/MultiVariantBaseModel.ts'

import type { MatrixCellData } from './components/computeVariantMatrixCells.ts'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const WebGLVariantMatrixComponent = lazy(
  () => import('./components/WebGLVariantMatrixComponent.tsx'),
)

export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantMatrixDisplay',
      MultiVariantBaseModelF(configSchema),
      types.model({
        type: types.literal('LinearVariantMatrixDisplay'),
        lineZoneHeight: types.optional(types.number, 20),
      }),
    )
    .volatile(() => ({
      webglCellData: undefined as MatrixCellData | undefined,
    }))
    .views(() => ({
      get DisplayMessageComponent() {
        return WebGLVariantMatrixComponent
      },
      get blockType() {
        return 'dynamicBlocks'
      },
      get prefersOffset() {
        return true
      },
      get featureWidgetType() {
        return {
          type: 'VariantFeatureWidget',
          id: 'variantFeature',
        }
      },
      get webglCellDataMode() {
        return 'matrix' as const
      },
      renderProps() {
        return { notReady: true }
      },
    }))
    .actions(self => ({
      setWebGLCellData(data: unknown) {
        self.webglCellData = data as MatrixCellData | undefined
      },
      setLineZoneHeight(n: number) {
        self.lineZoneHeight = clamp(n, 10, 1000)
        return self.lineZoneHeight
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
