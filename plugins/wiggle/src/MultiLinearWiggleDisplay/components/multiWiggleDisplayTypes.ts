import type { ScoreRamp } from '../../shared/ScoreLegend.tsx'
import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WiggleDataResult, WiggleFeatureUnderMouse } from '../../util.ts'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from '@jbrowse/tree-sidebar'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

export interface MultiWiggleDisplayModel
  extends WiggleGpuDisplayModel, WiggleGpuProps {
  id: string
  rpcDataMap: Map<number, WiggleDataResult>
  sources: { name: string; color?: string; labelColor?: string }[]
  sourcesWithoutLayout: { name: string }[]
  domain: [number, number] | undefined
  scaleType: string
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
  hasOverlayLegend: boolean
  scoreRamp: ScoreRamp | undefined
  setShowLegend: (arg: boolean) => void
  subtreeFilter?: string[]
  hoveredTreeNode?: HoveredTreeNode
  treeCanvas?: HTMLCanvasElement | null
  mouseoverCanvas?: HTMLCanvasElement | null
  featureUnderMouse?: WiggleFeatureUnderMouse
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
  setFeatureUnderMouse: (feat?: WiggleFeatureUnderMouse) => void
  selectFeature: (feat: WiggleFeatureUnderMouse) => void
}
