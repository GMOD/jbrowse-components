import { useState } from 'react'

import { useFeatureKey } from '../BaseFeatureDetail/featureKey.ts'
import { getTranscripts, rankTranscripts } from './featureTypeUtil.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { CanonicalTranscripts } from '../../util/isoformRank.ts'

/** Which of a container feature's transcripts the panel shows. */
export interface TranscriptPick {
  transcripts: SimpleFeatureSerialized[]
  /** best first, the order a menu lists them */
  ranked: { transcript: SimpleFeatureSerialized; index: number }[]
  index: number
  setIndex: (index: number) => void
}

// A pick belongs to the feature it was made on: the widget is reused when the
// user clicks another feature, which then opens on its own best transcript.
export function useTranscriptPick(
  feature: SimpleFeatureSerialized,
  canonicalTranscripts?: CanonicalTranscripts,
): TranscriptPick {
  const [picked, setPicked] = useState<{ key: string; index: number }>()
  const key = useFeatureKey(feature.uniqueId)
  const transcripts = getTranscripts(feature)
  const ranked = rankTranscripts(transcripts, canonicalTranscripts)
  const [best] = ranked
  return {
    transcripts,
    ranked,
    index: picked?.key === key ? picked.index : (best?.index ?? 0),
    setIndex: index => {
      setPicked({ key, index })
    },
  }
}
