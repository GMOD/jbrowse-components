import type { Slice } from '../CircularView/slices.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

// the part of a chord display's model that the chord components read. Kept
// structural (rather than an Instance of one display's state model) so any
// display drawing chords can satisfy it, and so the SVG-export path and the
// tests can hand these components a plain object
export interface ChordDisplayModel {
  error: unknown
  view: { offsetRadians: number }
  ready: boolean
  displayPhase: DisplayStatusPhase
  svgReady: boolean
  features: Feature[] | undefined
  // keyed by the *adapter's* refName, so a feature straight off the wire finds
  // its slice without further translation
  blocksForRefs: Record<string, Slice>
  selectedFeatureId: string | undefined
  configuration: AnyConfigurationModel
  radiusPx: number
  bezierRadius: number
  onChordClick: (feature: Feature) => void
  openErrorDialog: () => void
  reload: () => void
}
