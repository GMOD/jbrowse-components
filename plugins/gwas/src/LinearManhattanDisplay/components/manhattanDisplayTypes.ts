import type { ManhattanHit } from '../findManhattanHit.ts'
import type {
  ManhattanRenderState,
  ManhattanRenderingBackend,
  StoredManhattanData,
} from '../manhattanRenderingBackendTypes.ts'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type { SkippedFeatures } from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

/** The right-clicked point and the SNP it resolved to, held as one value. */
export type ManhattanContextMenuInfo = ContextMenuAnchor & { hit: ManhattanHit }

// Hand-rolled because naming the inferred model in `renderSvg.tsx` closes a
// type cycle
export interface ManhattanDisplayModel extends WiggleGpuDisplayModel<
  ManhattanRenderingBackend,
  StoredManhattanData
> {
  configuration: { displayId: string }
  renderBlocks: RenderBlock[]
  renderState: ManhattanRenderState
  scatterPointSize: number
  hoveredFeature: ManhattanHit | undefined
  indexSnpMissing: boolean
  skippedFeatures: SkippedFeatures
  notices: readonly string[]
  setHoveredFeature: (hit: ManhattanHit | undefined) => void
  clearHoveredFeature: () => void
  selectFeature: (hit: ManhattanHit) => void
  contextMenuInfo?: ManhattanContextMenuInfo
  openContextMenu: (info: ManhattanContextMenuInfo) => void
  closeContextMenu: () => void
  contextMenuItems: () => MenuItem[]
  setShowLegend: (val: boolean) => void
}
