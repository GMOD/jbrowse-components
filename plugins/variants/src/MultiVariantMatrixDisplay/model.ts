import { lazy } from 'react'

import { clamp } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import MultiSampleVariantBaseModelF from '../shared/MultiSampleVariantBaseModel.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { ExportSvgDisplayOptions } from '@jbrowse/plugin-linear-genome-view'

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
      renderProps() {
        return { notReady: true }
      },
      async renderSvg(opts?: ExportSvgDisplayOptions) {
        const { renderSvg } = await import('./renderSvg.tsx')
        return renderSvg(self as LinearVariantMatrixDisplayModel, opts)
      },
    }))
    .actions(self => ({
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
