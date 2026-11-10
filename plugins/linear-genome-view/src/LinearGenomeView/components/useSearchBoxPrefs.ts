import { useLocalStorage } from '@jbrowse/core/util/hooks'

import type { MenuItem } from '@jbrowse/core/ui'

/**
 * Visibility and orientation of the search-box strip a stacked-LGV header
 * draws, persisted per regime (few vs many rows) rather than under one global
 * key, so the "compact default" heuristic isn't permanently overridden by a
 * choice made in a differently-sized view.
 *
 * `prefix` keys the storage per container — the comparative view and the
 * breakpoint split view remember their own. Everything else is shared, because
 * the two headers held a copy each and the copies carried a comment telling the
 * next editor to change the labels in both. They already import
 * `HeaderSearchBoxRow` from this plugin, so the shared home costs no new
 * dependency edge.
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

/**
 * The menu rows that drive those prefs. "Stacked" rather than "Vertical": the
 * two headers name the same state and had drifted apart on it once already.
 */
export function searchBoxMenuItems({
  showSearchBoxes,
  setShowSearchBoxes,
  sideBySide,
  setSideBySide,
}: SearchBoxPrefs): MenuItem[] {
  return [
    {
      label: 'Show search boxes',
      type: 'checkbox',
      checked: showSearchBoxes,
      onClick: () => {
        setShowSearchBoxes(!showSearchBoxes)
      },
    },
    {
      label: 'Search box orientation',
      subMenu: [
        {
          label: 'Side-by-side',
          type: 'radio',
          checked: sideBySide,
          onClick: () => {
            setSideBySide(true)
          },
        },
        {
          label: 'Stacked',
          type: 'radio',
          checked: !sideBySide,
          onClick: () => {
            setSideBySide(false)
          },
        },
      ],
    },
  ]
}
