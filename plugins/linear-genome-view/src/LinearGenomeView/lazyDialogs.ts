import { lazy } from 'react'

export const ReturnToImportFormDialog = lazy(
  () => import('@jbrowse/core/ui/ReturnToImportFormDialog'),
)
export const SequenceSearchDialog = lazy(
  () => import('./components/SequenceSearchDialog.tsx'),
)
export const ExportSvgDialog = lazy(
  () => import('./components/ExportSvgDialog.tsx'),
)
export const GetSequenceDialog = lazy(
  () => import('./components/GetSequenceDialog.tsx'),
)
export const RegionWidthEditorDialog = lazy(
  () => import('./components/RegionWidthEditorDialog.tsx'),
)
export const AddCloseUpDialog = lazy(
  () => import('./components/AddCloseUpDialog.tsx'),
)
