import { useEffect, useState } from 'react'

import type { MenuItem, MenuItemsGetter } from './MenuTypes'

export function useAsyncMenuItems(
  menuItems: MenuItemsGetter,
  isOpen: boolean,
): { items: MenuItem[]; loading: boolean; error: unknown } {
  const [asyncState, setAsyncState] = useState<{
    items: MenuItem[]
    error: unknown
    fetchedFor: MenuItemsGetter | null
  }>({
    items: [],
    error: null,
    fetchedFor: null,
  })
  const isAsync = isOpen && typeof menuItems === 'function'

  useEffect(() => {
    if (!isAsync) {
      return
    }

    let cancelled = false

    Promise.resolve(menuItems())
      .then(items => {
        if (!cancelled) {
          setAsyncState({
            items,
            error: null,
            fetchedFor: menuItems,
          })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setAsyncState({
            items: [],
            error,
            fetchedFor: menuItems,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [menuItems, isAsync])

  if (!isOpen) {
    return { items: [], loading: false, error: null }
  }

  if (Array.isArray(menuItems)) {
    return { items: menuItems, loading: false, error: null }
  }

  const loading = asyncState.fetchedFor !== menuItems
  return { items: asyncState.items, loading, error: asyncState.error }
}
