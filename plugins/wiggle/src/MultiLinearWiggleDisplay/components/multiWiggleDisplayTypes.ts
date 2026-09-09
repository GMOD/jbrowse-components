import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WigglePlotGeometry } from '../../shared/wiggleDisplayViews.ts'
import type { WiggleHoveredFeature } from '../../util.ts'
import type { MultiWiggleContextHit } from './findHit.ts'
import type { ContextMenuAnchor, MenuItem } from '@jbrowse/core/ui'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from '@jbrowse/tree-sidebar'
import type {
  WiggleDataResult,
  WiggleGpuDisplayModel,
  YAxis,
} from '@jbrowse/wiggle-core'

export interface MultiWiggleDisplayModel
  extends WiggleGpuDisplayModel, WiggleGpuProps {
  id: string
  // read by DisplayChrome, which publishes it as `data-display-id` — the stable
  // hook the browser tests use to target one track's display
  configuration: { displayId: string }
  rpcDataMap: ReadonlyMap<number, WiggleDataResult>
  sources: { name: string; color?: string; labelColor?: string }[]
  sourcesWithoutLayout: { name: string }[]
  domain: [number, number] | undefined
  scaleType: string
  // where the plot canvas sits inside the display's height — the same value
  // `valueScales` and the SVG export are laid out against
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
  axes: YAxis[]
  scoreRampApplies: boolean
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  showTree: boolean
  showRowSeparators: boolean
  showRowLabels: boolean
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
  setScrollTop: (scrollTop: number) => void
  setHoveredFeature: (feat?: WiggleHoveredFeature) => void
  clearHoveredFeature: () => void
  selectFeature: (feat: WiggleHoveredFeature) => void
  contextMenuInfo?: ContextMenuAnchor & MultiWiggleContextHit
  openContextMenu: (info: ContextMenuAnchor & MultiWiggleContextHit) => void
  closeContextMenu: () => void
  contextMenuItems: () => MenuItem[]
}
