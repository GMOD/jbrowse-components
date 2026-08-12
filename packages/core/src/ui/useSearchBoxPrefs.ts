import { useLocalStorage } from '../util/hooks.ts'

/**
 * Search-box visibility/orientation for a multi-view header, persisted per
 * *regime* (few vs many views) rather than under one global key — so the
 * "compact default" heuristic isn't permanently overridden by a choice the user
 * made in a differently-sized view.
 *
 * `prefix` names the view type ('lcv', 'bsv'), which is what keeps the two
 * headers' settings apart. It is a parameter rather than two copies of this
 * hook because the copies had already been written twice, comment included, and
 * a change to the regime threshold in one would not have reached the other.
 */
export function useSearchBoxPrefs(prefix: string, numViews: number) {
  const compact = numViews <= 3
  const regime = compact ? 'compact' : 'large'
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    `${prefix}-showSearchBoxes-${regime}`,
    compact,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(
    `${prefix}-sideBySide-${regime}`,
    compact,
  )
  return { showSearchBoxes, setShowSearchBoxes, sideBySide, setSideBySide }
}

export type SearchBoxPrefs = ReturnType<typeof useSearchBoxPrefs>
