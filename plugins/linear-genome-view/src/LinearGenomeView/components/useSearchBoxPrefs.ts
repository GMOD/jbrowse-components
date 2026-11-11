import { useLocalStorage } from '@jbrowse/core/util/hooks'
import {
  localStorageGetBoolean,
  localStorageSetItem,
  notifyLocalStorageKey,
} from '@jbrowse/core/util/localStorage'

import type { MenuItem } from '@jbrowse/core/ui'

function searchBoxPrefKeys(prefix: string, numViews: number) {
  const compact = numViews <= 3
  const regime = compact ? 'compact' : 'large'
  return {
    compact,
    showKey: `${prefix}-showSearchBoxes-${regime}`,
    sideKey: `${prefix}-sideBySide-${regime}`,
  }
}

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
  const { compact, showKey, sideKey } = searchBoxPrefKeys(prefix, numViews)
  const [showSearchBoxes, setShowSearchBoxes] = useLocalStorage(
    showKey,
    compact,
  )
  const [sideBySide, setSideBySide] = useLocalStorage(sideKey, compact)
  return { showSearchBoxes, setShowSearchBoxes, sideBySide, setSideBySide }
}

export interface SearchBoxPrefs {
  showSearchBoxes: boolean
  setShowSearchBoxes: (value: boolean) => void
  sideBySide: boolean
  setSideBySide: (value: boolean) => void
}

function writeStoredBoolean(key: string, value: boolean) {
  if (localStorageSetItem(key, JSON.stringify(value))) {
    notifyLocalStorageKey(key)
  }
}

/**
 * The same prefs read from the store outside React, for a model's menu: a
 * write announces itself, so a header holding `useSearchBoxPrefs` on the same
 * keys follows it. The open menu does not, so its rows pass
 * `keepMenuOpen: false` to `searchBoxMenuItems`.
 */
export function storedSearchBoxPrefs(prefix: string, numViews: number) {
  const { compact, showKey, sideKey } = searchBoxPrefKeys(prefix, numViews)
  return {
    showSearchBoxes: localStorageGetBoolean(showKey, compact),
    setShowSearchBoxes: (value: boolean) => {
      writeStoredBoolean(showKey, value)
    },
    sideBySide: localStorageGetBoolean(sideKey, compact),
    setSideBySide: (value: boolean) => {
      writeStoredBoolean(sideKey, value)
    },
  }
}

/**
 * The menu rows that drive those prefs. "Stacked" rather than "Vertical": the
 * two headers name the same state and had drifted apart on it once already.
 */
export function searchBoxMenuItems(
  {
    showSearchBoxes,
    setShowSearchBoxes,
    sideBySide,
    setSideBySide,
  }: SearchBoxPrefs,
  { keepMenuOpen }: { keepMenuOpen?: boolean } = {},
): MenuItem[] {
  return [
    {
      label: 'Show search boxes',
      type: 'checkbox',
      checked: showSearchBoxes,
      keepMenuOpen,
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
          keepMenuOpen,
          onClick: () => {
            setSideBySide(true)
          },
        },
        {
          label: 'Stacked',
          type: 'radio',
          checked: !sideBySide,
          keepMenuOpen,
          onClick: () => {
            setSideBySide(false)
          },
        },
      ],
    },
  ]
}
