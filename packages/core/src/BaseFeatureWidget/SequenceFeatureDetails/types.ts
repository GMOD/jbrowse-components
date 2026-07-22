import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { SeqState } from '../util.tsx'
import type {
  SequenceDisplayMode,
  SequenceFeatureDetailsModel,
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
  ref?: RefObject<HTMLDivElement | null>
}
