import { useLocalStorage } from '@jbrowse/core/util/hooks'

// Persist search-box visibility/orientation per regime (few vs many rows)
// rather than one global key, so the "compact default" heuristic isn't
// permanently overridden by a choice made in a differently-sized view.
//
// The linear comparative view's header keeps its own copy of this under an
// `lcv-` prefix, deliberately: sharing it means either @jbrowse/core, which is
// far too general a home for a setting only stacked-LGV headers have, or a
// plugin-to-plugin import for twenty lines. What sharing was worth having is
// that the two menus agree on what to CALL this — `sideBySide: false` is
// "Stacked" in both — so if you change a label, change it there too.
export function useSearchBoxPrefs(numViews: number) {
  const compact = numViews <= 3
  const regime = compact ? 'compact' : 'large'
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    `bsv-showSearchBoxes-${regime}`,
    compact,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(
    `bsv-sideBySide-${regime}`,
    compact,
  )
  return { showSearchBoxes, setShowSearchBoxes, sideBySide, setSideBySide }
}

export type SearchBoxPrefs = ReturnType<typeof useSearchBoxPrefs>
