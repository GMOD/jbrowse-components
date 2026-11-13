import { useSyncExternalStore } from 'react'

import {
  localStorageGetBoolean,
  localStorageSetItem,
  notifyLocalStorageKey,
  subscribeToLocalStorageKey,
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

// What the store refused to take (blocked third-party storage, a full quota),
// held for the page's life so a header and a model's menu still agree.
const unsaved = new Map<string, boolean>()

function readPref(key: string, defaultVal: boolean) {
  return unsaved.get(key) ?? localStorageGetBoolean(key, defaultVal)
}

function writePref(key: string, value: boolean) {
  if (localStorageSetItem(key, JSON.stringify(value))) {
    unsaved.delete(key)
  } else {
    unsaved.set(key, value)
  }
  notifyLocalStorageKey(key)
}

function usePref(key: string, defaultVal: boolean) {
  return useSyncExternalStore(
    notify => subscribeToLocalStorageKey(key, notify),
    () => readPref(key, defaultVal),
    () => defaultVal,
  )
}

function prefSetters(showKey: string, sideKey: string) {
  return {
    setShowSearchBoxes: (value: boolean) => {
      writePref(showKey, value)
    },
    setSideBySide: (value: boolean) => {
      writePref(sideKey, value)
    },
  }
}

export interface SearchBoxPrefs {
  showSearchBoxes: boolean
  setShowSearchBoxes: (value: boolean) => void
  sideBySide: boolean
  setSideBySide: (value: boolean) => void
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
  return {
    showSearchBoxes: usePref(showKey, compact),
    sideBySide: usePref(sideKey, compact),
    ...prefSetters(showKey, sideKey),
  }
}

/**
 * The same prefs read outside React, for a model's menu. A write announces
 * itself, so a header holding `useSearchBoxPrefs` on the same keys follows it.
 * The open menu does not, so its rows pass `keepMenuOpen: false` to
 * `searchBoxMenuItems`.
 */
export function storedSearchBoxPrefs(prefix: string, numViews: number) {
  const { compact, showKey, sideKey } = searchBoxPrefKeys(prefix, numViews)
  return {
    showSearchBoxes: readPref(showKey, compact),
    sideBySide: readPref(sideKey, compact),
    ...prefSetters(showKey, sideKey),
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
  {
    keepMenuOpen,
    disabled,
  }: { keepMenuOpen?: boolean; disabled?: boolean } = {},
): MenuItem[] {
  return [
    {
      label: 'Show search boxes',
      type: 'checkbox',
      checked: showSearchBoxes,
      keepMenuOpen,
      disabled,
      onClick: () => {
        setShowSearchBoxes(!showSearchBoxes)
      },
    },
    {
      label: 'Show search boxes stacked',
      type: 'checkbox',
      checked: !sideBySide,
      keepMenuOpen,
      disabled,
      onClick: () => {
        setSideBySide(!sideBySide)
      },
    },
  ]
}
