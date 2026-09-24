import type { Slice } from '../CircularView/slices.ts'
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

// What the chord and ribbon components both read. A slice is looked up by the
// assembly AND refName a feature carries, since two genomes on one circle can
// each carry a `chr1`
interface ChordLayerModel extends ChordDisplayFrameModel {
  drawnFeatures: Feature[] | undefined
  selectedFeatureId: string | undefined
  highlightedFeatureIdSet?: Set<string>
  bezierRadius: number
  sliceFor: (
    assemblyName: string | undefined,
    refName: string,
  ) => Slice | undefined
}

export interface ChordDisplayModel extends ChordLayerModel {
  onChordClick: (feature: Feature) => void
}

export interface RibbonDisplayModel extends ChordLayerModel {
  ribbonFill: (feature: Feature) => string
  onRibbonClick: (feature: Feature) => void
}
