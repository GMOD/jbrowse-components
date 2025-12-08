import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import type { MenuItem as JBMenuItem } from './Menu'
import type { PopupState } from './hooks'

export type MenuItemsGetter =
  | JBMenuItem[]
  | (() => JBMenuItem[])
  | (() => Promise<JBMenuItem[]>)

export const CascadingContext = createContext({
  parentPopupState: undefined,
  rootPopupState: undefined,
} as {
  parentPopupState: PopupState | undefined
  rootPopupState: PopupState | undefined
})

export function useAsyncMenuItems(
  menuItems: MenuItemsGetter,
  isOpen: boolean,
): { items: JBMenuItem[]; loading: boolean; error: unknown } {
  const [asyncState, setAsyncState] = useState<{
    items: JBMenuItem[]
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

export function useCascadingContext(popupState: PopupState) {
  const { rootPopupState } = useContext(CascadingContext)
  return useMemo(
    () => ({
      rootPopupState: rootPopupState || popupState,
      parentPopupState: popupState,
    }),
    [rootPopupState, popupState],
  )
}

export function closeSiblingSubmenus(parentPopupState: PopupState | undefined) {
  if (parentPopupState?.childHandle) {
    parentPopupState.childHandle.close()
    parentPopupState.setChildHandle(undefined)
  }
}
