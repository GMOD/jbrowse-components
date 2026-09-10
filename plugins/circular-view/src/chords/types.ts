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
  view: { offsetRadians: number }
  ready: boolean
  displayPhase: DisplayStatusPhase
  svgReady: boolean
  configuration: AnyConfigurationModel
  radiusPx: number
  openErrorDialog: () => void
  reload: () => void
}

// the part of a chord display's model that the chord components read
export interface ChordDisplayModel extends ChordDisplayFrameModel {
  features: Feature[] | undefined
  // keyed by the *adapter's* refName, so a feature straight off the wire finds
  // its slice without further translation
  blocksForRefs: Record<string, Slice>
  selectedFeatureId: string | undefined
  bezierRadius: number
  onChordClick: (feature: Feature) => void
}

// the ribbon components' half. A synteny record names an assembly on each side,
// so the slice lookup takes both: two assemblies on one circle can each carry a
// `chr1`, and a refName-keyed table answers whichever was written last
export interface RibbonDisplayModel extends ChordDisplayFrameModel {
  features: Feature[] | undefined
  selectedFeatureId: string | undefined
  bezierRadius: number
  sliceFor: (
    assemblyName: string | undefined,
    refName: string,
  ) => Slice | undefined
  onRibbonClick: (feature: Feature) => void
}
