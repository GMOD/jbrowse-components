import type { ScoreRamp } from '../../shared/ScoreLegend.tsx'
import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WigglePlotGeometry } from '../../shared/wiggleDisplayViews.ts'
import type { WiggleHoveredFeature } from '../../util.ts'
import type { MultiWiggleContextHit } from './findHit.ts'
import type { ContextMenuAnchor, LegendItem, MenuItem } from '@jbrowse/core/ui'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from '@jbrowse/tree-sidebar'
import type {
  WiggleDataResult,
  WiggleGpuDisplayModel,
} from '@jbrowse/wiggle-core'

export interface MultiWiggleDisplayModel
  extends WiggleGpuDisplayModel, WiggleGpuProps {
  id: string
  // read by DisplayChrome, which publishes it as `data-display-id` — the stable
  // hook the browser tests use to target one track's display
  configuration: { displayId: string }
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  sources: { name: string; color?: string; labelColor?: string }[]
  // the color key, collapsed and color-resolved by the model — the one list
  // both the on-screen FloatingLegend and the export draw
  legendItems: LegendItem[]
  sourcesWithoutLayout: { name: string }[]
  domain: [number, number] | undefined
  scaleType: string
  // raw slot; the score legend resolves it so its ramp is painted with the
  // same constant the backends were handed
  symlogConstant: number
  // where the plot canvas sits inside the display's height — the same value
  // `ticks` and the SVG export are laid out against
  plotGeometry: WigglePlotGeometry
  // WiggleGpuProps above carries the raw `summaryScoreMode` slot (the encoder
  // wants it verbatim); the hit/tooltip path reads the resolved one, which is
  // what density actually draws
  effectiveSummaryScoreMode: string
  isOverlay: boolean
  isDensityMode: boolean
  numSources: number
  numRows: number
  effectiveRowHeight: number
  rowHeightTooSmallForScalebar: boolean
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  showTree: boolean
  showRowSeparators: boolean
  showRowLabels: boolean
  hasOverlayLegend: boolean
  scoreRamp: ScoreRamp | undefined
  setShowLegend: (arg: boolean) => void
  subtreeFilter?: string[]
  hoveredTreeNode?: HoveredTreeNode
  treeCanvas?: HTMLCanvasElement | null
  mouseoverCanvas?: HTMLCanvasElement | null
  hoveredFeature?: WiggleHoveredFeature
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
  setHoveredFeature: (feat?: WiggleHoveredFeature) => void
  selectFeature: (feat: WiggleHoveredFeature) => void
  contextMenuInfo?: ContextMenuAnchor & MultiWiggleContextHit
  openContextMenu: (info: ContextMenuAnchor & MultiWiggleContextHit) => void
  closeContextMenu: () => void
  contextMenuItems: () => MenuItem[]
}
