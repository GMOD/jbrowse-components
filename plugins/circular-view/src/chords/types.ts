import type { Slice } from '../CircularView/slices.ts'
import type { ChordCell } from './chordMarks.ts'
import type { ChordShape, ChordLayerDisplay, RibbonShape } from './shapes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

// what `ChordDisplayFrame` reads: the lifecycle, and the two circle-sized
// things its error and loading states are drawn against. Kept structural
// (rather than an Instance of one display's state model) so any display drawing
// into the circle can satisfy it, and so the SVG-export path and the tests can
// hand these components a plain object
export interface ChordDisplayFrameModel {
  error: unknown
  displayError: unknown
  view: {
    offsetRadians: number
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

export const DIMMED_OPACITY = 0.15

/** `DIMMED_OPACITY` as a packed colour's alpha byte. */
export const DIMMED_ALPHA = Math.round(DIMMED_OPACITY * 255)

// What the chord and ribbon displays both answer. The canvas draws their lanes
// through `chordCell`; the SVG side draws the hovered and selected shapes over
// it, and the export draws every shape
interface ChordLayerModel extends ChordDisplayFrameModel, ChordLayerDisplay {
  drawnFeatures: Feature[] | undefined
  drawnCount: number
  selectedFeatureId: string | undefined
  hoveredFeatureId: string | undefined
  highlightedFeatureIdSet?: Set<string>
  bezierRadius: number
  shapeAlpha: number
  sliceFor: (
    assemblyName: string | undefined,
    refName: string,
  ) => Slice | undefined
}

export interface ChordDisplayModel extends ChordLayerModel {
  shapes: readonly ChordShape[]
  shapeFor: (featureId: string) => ChordShape | undefined
}

export interface RibbonDisplayModel extends ChordLayerModel {
  shapes: readonly RibbonShape[]
  shapeFor: (featureId: string) => RibbonShape | undefined
}
