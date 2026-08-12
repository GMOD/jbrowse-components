import { checkboxItem, radioItems } from '@jbrowse/core/ui/menuItems'
import { useLocalStorage } from '@jbrowse/core/util/hooks'

import type { MenuItem } from '@jbrowse/core/ui/menuItems'

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

// The orientations, as the menu offers them. `sideBySide` is a boolean in
// storage and a two-option radio on screen, so the mapping lives here once
// rather than at each header's menu.
const ORIENTATIONS = [
  { value: 'sideBySide', label: 'Side-by-side' },
  { value: 'stacked', label: 'Stacked' },
] as const

/**
 * The menu rows that edit {@link useSearchBoxPrefs}.
 *
 * Both headers offering this hook also spelled out its two rows, and the copies
 * had already drifted where it shows: the same `sideBySide: false` state was
 * "Stacked" in the breakpoint split view and "Vertical" in the comparative one.
 * Sharing the state without sharing the rows that set it leaves exactly that
 * gap — one setting, two names for it, depending on which view you opened.
 */
export function searchBoxPrefsMenuItems({
  showSearchBoxes,
  setShowSearchBoxes,
  sideBySide,
  setSideBySide,
}: SearchBoxPrefs): MenuItem[] {
  return [
    checkboxItem('Show search boxes', showSearchBoxes, () => {
      setShowSearchBoxes(!showSearchBoxes)
    }),
    {
      label: 'Search box orientation',
      subMenu: radioItems(
        ORIENTATIONS,
        sideBySide ? 'sideBySide' : 'stacked',
        mode => {
          setSideBySide(mode === 'sideBySide')
        },
      ),
    },
  ]
}
