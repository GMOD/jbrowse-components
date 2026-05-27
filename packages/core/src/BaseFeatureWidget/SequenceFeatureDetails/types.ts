import type { RefObject } from 'react'

import type { SequenceFeatureDetailsModel } from './model.ts'
import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { SeqState } from '../util.tsx'

export interface SequencePanelProps {
  sequence: SeqState
  feature: SimpleFeatureSerialized
  model: SequenceFeatureDetailsModel
  ref?: RefObject<HTMLDivElement | null>
}
