import { useLocalStorage } from '@jbrowse/core/util'

// Persist search-box visibility/orientation per regime (few vs many genomes)
// rather than one global key, so the "compact default" heuristic isn't
// permanently overridden by a choice made in a differently-sized view.
export function useSearchBoxPrefs(numViews: number) {
  const compact = numViews <= 3
  const regime = compact ? 'compact' : 'large'
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    `lcv-showSearchBoxes-${regime}`,
    compact,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(
    `lcv-sideBySide-${regime}`,
    compact,
  )
  return { showSearchBoxes, setShowSearchBoxes, sideBySide, setSideBySide }
}

export type SearchBoxPrefs = ReturnType<typeof useSearchBoxPrefs>
