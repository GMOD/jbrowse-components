import type { Slice } from '../CircularView/slices.ts'
import type { ChordPaintSource, ChordShape, RibbonShape } from './shapes.ts'
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
  view: { offsetRadians: number }
  ready: boolean
  displayPhase: DisplayStatusPhase
  svgReady: boolean
  configuration: AnyConfigurationModel
  radiusPx: number
  openErrorDialog: () => void
  reload: () => void
}

export const DIMMED_OPACITY = 0.15

// What the chord and ribbon layers both read. The resting shapes go to the
// view's canvas through `ChordPaintSource`; the hovered and selected ones are
// SVG paths over it, and the export draws every shape as one
interface ChordLayerModel extends ChordDisplayFrameModel, ChordPaintSource {
  drawnFeatures: Feature[] | undefined
  selectedFeatureId: string | undefined
  hoveredFeatureId: string | undefined
  sliceFor: (
    assemblyName: string | undefined,
    refName: string,
  ) => Slice | undefined
  clickFeature: (feature: Feature) => void
  shapeLabel: (feature: Feature) => string
}

export interface ChordDisplayModel extends ChordLayerModel {
  shapes: readonly ChordShape[]
}

export interface RibbonDisplayModel extends ChordLayerModel {
  shapes: readonly RibbonShape[]
}
