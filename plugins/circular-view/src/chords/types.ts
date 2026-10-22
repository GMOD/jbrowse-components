import type { ChordCell } from './chordMarks.ts'
import type { ChordLayerDisplay, Shape } from './shapes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

// what `ChordDisplayFrame` reads: the lifecycle, and the two circle-sized
// things its error and loading states are drawn against. Kept structural
// (rather than an Instance of one display's state model) so any display drawing
// into the circle can satisfy it, and so the SVG-export path and the tests can
// hand these components a plain object
export interface ChordDisplayFrameModel {
  id: string
  error: unknown
  displayError: unknown
  view: {
    offsetRadians: number
    chordDisplays: readonly { id: string; displayPhase: DisplayStatusPhase }[]
    chordPass: { drew: (cell: ChordCell) => boolean; renderError: unknown }
  }
  chordCell: ChordCell | undefined
  ready: boolean
  displayPhase: DisplayStatusPhase
  svgReady: boolean
  configuration: AnyConfigurationModel
  radiusPx: number
  openErrorDialog: () => void
  reload: () => void
}

// What the chord and ribbon displays both answer. The canvas draws their lanes
// through `chordCell`; the SVG side draws the hovered and selected shapes over
// it, and the export draws every shape
export interface ShapeDisplayModel
  extends ChordDisplayFrameModel, ChordLayerDisplay {
  drawnCount: number
  selectedFeatureId: string | undefined
  hoveredFeatureId: string | undefined
  highlightedFeatureIdSet?: Set<string>
  bezierRadius: number
  shapeAlpha: number
  shapes: readonly Shape[]
  shapesTestId: string
  shapeFor: (featureId: string) => Shape | undefined
}
