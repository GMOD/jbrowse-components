import type { Source } from '../types.ts'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

// What the left-hand sample gutter (SvgSampleRowLabelGutter) reads: the rows to
// label, how tall they are, and where the viewport currently sits.
//
// The viewport is `availableHeight`, not the display `height`: the rows sit below
// `lineZoneHeight` (the matrix display's connector zone), so the band the gutter
// clips and virtualizes against is what's left after it — same height the canvas
// under it is drawn at.
export interface SampleRowLabelsModel {
  id: string
  // for svgDisplayId, so the gutter's clip id is stable across session loads
  configuration?: { displayId?: string }
  scrollTop: number
  availableHeight: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  canDisplayLabels: boolean
  effectiveRowHeight: number
  // Resolved, never absent — the model's `sources` getter answers `[]` before
  // any fetch has landed. "No rows yet" is `loading` / `displayPhase`, not a
  // missing array; see the getter's own note.
  sources: Source[]
  showTree: boolean
}
