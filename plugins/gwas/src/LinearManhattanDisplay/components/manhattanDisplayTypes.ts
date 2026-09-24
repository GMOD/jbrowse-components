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

// Component-facing slice of LinearManhattanDisplayModel. Hand-rolled because
// `renderSvg.tsx` intersects this with `ScorePlotSvgModel` and
// naming the inferred model there closes a type cycle; the component takes the
// same slice so the two can't disagree about what a manhattan display is.
export interface ManhattanDisplayModel extends WiggleGpuDisplayModel<
  ManhattanRenderingBackend,
  StoredManhattanData
> {
  // read by DisplayChrome, which publishes it as `data-display-id` — the stable
  // hook the browser tests use to target one track's display
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
