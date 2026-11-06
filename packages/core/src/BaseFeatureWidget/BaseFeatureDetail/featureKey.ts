import { createContext, useContext } from 'react'

// A feature id is unique only within its track, so per-feature UI state keys on
// both: two GFF3 tracks can each hold a gene `chr1-12`.
export function featureKey(trackId: string | undefined, uniqueId: string) {
  return `${trackId ?? ''}/${uniqueId}`
}

export const FeatureTrackContext = createContext<string | undefined>(undefined)

export function useFeatureKey(uniqueId: string) {
  return featureKey(useContext(FeatureTrackContext), uniqueId)
}
