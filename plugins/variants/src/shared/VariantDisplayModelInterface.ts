import type React from 'react'

export interface VariantDisplayModelBase {
  availableHeight: number
  rowHeight: number
  scrollTop: number
  totalHeight: number
  nrow: number
  sources: { name: string; sampleName?: string }[] | undefined
  featuresVolatile:
    | { id(): string; toJSON(): Record<string, unknown> }[]
    | undefined
  referenceDrawingMode: string
  regionTooLarge: boolean
  featuresReady: boolean
  displayError: unknown
  reload: () => void
  setFeatureDensityStatsLimit: (s?: unknown) => void
  setHoveredGenotype: (tooltip: Record<string, string> | undefined) => void
  setScrollTop: (n: number) => void
  setRowHeight: (n: number) => void
  selectFeature: (feature: { id(): string }) => void
  setContextMenuFeature: (feature?: { id(): string }) => void
  contextMenuItems: () => { label: string; onClick: () => void }[]
  regionCannotBeRendered: () => React.ReactElement | null
}
