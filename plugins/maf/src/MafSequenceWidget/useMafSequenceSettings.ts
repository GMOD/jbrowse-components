import { useLocalStorage } from '@jbrowse/core/util'

// Persisted view/format preferences for the MAF sequence widget. Bundled into
// one hook so the widget body stays focused on data fetching and layout.
export function useMafSequenceSettings() {
  const [showAllLetters, setShowAllLetters] = useLocalStorage(
    'mafSequenceWidget-showAllLetters',
    true,
  )
  const [includeInsertions, setIncludeInsertions] = useLocalStorage(
    'mafSequenceWidget-includeInsertions',
    false,
  )
  const [singleLineFormat, setSingleLineFormat] = useLocalStorage(
    'mafSequenceWidget-singleLineFormat',
    false,
  )
  const [colorBackground, setColorBackground] = useLocalStorage(
    'mafSequenceWidget-colorBackground',
    true,
  )
  const [showSampleNames, setShowSampleNames] = useLocalStorage(
    'mafSequenceWidget-showSampleNames',
    true,
  )
  return {
    showAllLetters,
    setShowAllLetters,
    includeInsertions,
    setIncludeInsertions,
    singleLineFormat,
    setSingleLineFormat,
    colorBackground,
    setColorBackground,
    showSampleNames,
    setShowSampleNames,
  }
}

export type MafSequenceSettings = ReturnType<typeof useMafSequenceSettings>
