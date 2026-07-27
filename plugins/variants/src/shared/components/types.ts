import type { Source } from '../types.ts'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

// What the left-hand sample gutter (SvgSampleRowLabelGutter) reads: the rows to
// label, how tall they are, and where the viewport currently sits.
export interface SampleRowLabelsModel {
  id: string
  scrollTop: number
  height: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  totalHeight: number
  canDisplayLabels: boolean
  effectiveRowHeight: number
  sources?: Source[]
  showTree: boolean
}
