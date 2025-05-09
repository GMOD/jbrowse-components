import type { SequenceFeatureDetailsModel } from './model'
import type { SimpleFeatureSerialized } from '../../util'
import type { SeqState } from '../util'

export interface SequencePanelProps {
  sequence: SeqState
  feature: SimpleFeatureSerialized
  model: SequenceFeatureDetailsModel
}
