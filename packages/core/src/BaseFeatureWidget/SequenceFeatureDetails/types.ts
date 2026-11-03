import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
  SequenceHoverTarget,
} from './model.ts'
import type { RefObject } from 'react'

export interface SequencePanelProps {
  sequence: SeqState
  feature: SimpleFeatureSerialized
  model: SequenceFeatureDetailsModel
  mode: SequenceDisplayMode
  revcomp?: boolean
  assemblyGeneticCodeId?: number
  // lets the LGV crosshair resolve the feature's refName through the assembly's
  // aliases; without it a non-canonical refName (e.g. '1' vs 'chr1') never
  // matches the displayed region and the crosshair silently doesn't draw
  assemblyName?: string
  // where hovered bases are published for the LGV crosshair. Must be referen-
  // tially stable (it is the owning widget/display), since a fresh identity
  // each render would clear the hover it just set
  hoverTarget?: SequenceHoverTarget
  ref?: RefObject<HTMLDivElement | null>
}

export interface Feat {
  start: number
  end: number
  type?: string
  name?: string
  id?: string | number
  phase?: number
}

export interface SeqState {
  seq: string
  upstream?: string
  downstream?: string
}

export interface ErrorState {
  error: string
}
