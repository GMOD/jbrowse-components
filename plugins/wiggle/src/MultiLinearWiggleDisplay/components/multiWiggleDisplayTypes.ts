import type { WiggleGpuProps } from '../../shared/buildSourceRenderData.ts'
import type { WiggleDataResult } from '../../util.ts'
import type {
  ClusterHierarchyNode,
  HoveredTreeNode,
} from '@jbrowse/tree-sidebar'
import type { WiggleGpuDisplayModel } from '@jbrowse/wiggle-core'

export interface MultiWiggleDisplayModel
  extends WiggleGpuDisplayModel,
    WiggleGpuProps {
  rpcDataMap: Map<number, WiggleDataResult>
  sources: { name: string; color?: string; labelColor?: string }[]
  domain: [number, number] | undefined
  scaleType: string
  isOverlay: boolean
  numSources: number
  rowHeight: number
  rowHeightTooSmallForScalebar: boolean
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  showTree: boolean
  showRowSeparators: boolean
  subtreeFilter?: string[]
  hoveredTreeNode?: HoveredTreeNode
  treeCanvas?: HTMLCanvasElement | null
  mouseoverCanvas?: HTMLCanvasElement | null
  featureUnderMouse?: {
    refName: string
    start: number
    end: number
    score: number
    minScore?: number
    maxScore?: number
    source: string
    summary?: boolean
    allSources?: {
      source: string
      score: number
      minScore?: number
      maxScore?: number
      summary?: boolean
    }[]
  }
  setTreeCanvasRef: (ref: HTMLCanvasElement | null) => void
  setMouseoverCanvasRef: (ref: HTMLCanvasElement | null) => void
  setHoveredTreeNode: (node?: HoveredTreeNode) => void
  setTreeAreaWidth: (width: number) => void
  setSubtreeFilter: (names?: string[]) => void
  setFeatureUnderMouse: (
    feat?: MultiWiggleDisplayModel['featureUnderMouse'],
  ) => void
  selectFeature: (
    feat: NonNullable<MultiWiggleDisplayModel['featureUnderMouse']>,
  ) => void
}
