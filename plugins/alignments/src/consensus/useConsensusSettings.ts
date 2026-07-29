import { useLocalStorage } from '@jbrowse/core/util/hooks'

// Persisted across dialog openings: a consensus is usually re-run at the same
// thresholds on region after region, so re-picking them each time is the common
// case, not the rare one.
export function useConsensusSettings() {
  const [showOptions, setShowOptions] = useLocalStorage(
    'consensus-showOptions',
    false,
  )
  const [minDepth, setMinDepth] = useLocalStorage('consensus-minDepth', 1)
  const [callFract, setCallFract] = useLocalStorage('consensus-callFract', 0.75)
  const [ambiguityCodes, setAmbiguityCodes] = useLocalStorage(
    'consensus-ambiguityCodes',
    false,
  )
  const [hetFract, setHetFract] = useLocalStorage('consensus-hetFract', 0.5)
  const [includeInsertions, setIncludeInsertions] = useLocalStorage(
    'consensus-includeInsertions',
    true,
  )
  const [excludeSecondary, setExcludeSecondary] = useLocalStorage(
    'consensus-excludeSecondary',
    true,
  )
  return {
    showOptions,
    setShowOptions,
    minDepth,
    setMinDepth,
    callFract,
    setCallFract,
    ambiguityCodes,
    setAmbiguityCodes,
    hetFract,
    setHetFract,
    includeInsertions,
    setIncludeInsertions,
    excludeSecondary,
    setExcludeSecondary,
  }
}

export type ConsensusSettings = ReturnType<typeof useConsensusSettings>
