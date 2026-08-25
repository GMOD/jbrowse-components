import type { Source } from '../types.ts'
import type { ClusterHierarchyNode } from '@jbrowse/tree-sidebar'

// What the overlays over the rows read — the on-screen one and the SVG
// export's: the rows, how tall they are, where the viewport sits, and the
// sidebar geometry the labels are offset by.
//
// The viewport is `availableHeight`, not the display `height`: the rows sit
// below the bands stacked above them (the variant lane, the matrix display's
// connector zone), so the band the labels are culled against is what's left
// after them — same height the canvas under it is drawn at.
export interface VariantRowsModel {
  scrollTop: number
  availableHeight: number
  hierarchy?: ClusterHierarchyNode
  treeAreaWidth: number
  effectiveRowHeight: number
  // Resolved, never absent — the model's `sources` getter answers `[]` before
  // any fetch has landed. "No rows yet" is `loading` / `displayPhase`, not a
  // missing array; see the getter's own note.
  sources: Source[]
  showTree: boolean
  showRowLabels: boolean
  showRowSeparators: boolean
  canvasWidthPx: number
}
