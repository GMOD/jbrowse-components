import type { MarkShapeName } from '../configSchema.ts'
import type { MarkHitInfo } from '../findMarkHit.ts'
import type { MarkLegendSection } from '../legend.ts'
import type {
  DisplayMark,
  MarkRegionData,
  MarkRenderState,
} from '../markList.ts'
import type { MarkRenderingBackend } from '../model.ts'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

export type MarkDisplayContextMenuInfo = ContextMenuAnchor & {
  hit: MarkHitInfo
}

// The slice of the model the component and the SVG export read. Hand-rolled
// for the reason Manhattan's is: `renderSvg.tsx` is imported from an action of
// the model, so naming the inferred model type there closes a type cycle.
export interface MarkDisplayModel extends WiggleGpuDisplayModel<
  MarkRenderingBackend,
  MarkRegionData
> {
  configuration: { displayId: string }
  renderBlocks: RenderBlock[]
  regionRefNames: ReadonlyMap<number, string>
  markList: DisplayMark[]
  markShapes: MarkShapeName[]
  renderState: MarkRenderState
  scatterPointSize: number
  hoveredFeature: MarkHitInfo | undefined
  legendSections: MarkLegendSection[]
  showLegend: boolean
  setHoveredFeature: (hit: MarkHitInfo | undefined) => void
  clearHoveredFeature: () => void
  selectFeature: (hit: MarkHitInfo) => void
  setShowLegend: (val: boolean) => void
  contextMenuInfo?: MarkDisplayContextMenuInfo
  openContextMenu: (info: MarkDisplayContextMenuInfo) => void
  closeContextMenu: () => void
  contextMenuItems: () => MenuItem[]
}
