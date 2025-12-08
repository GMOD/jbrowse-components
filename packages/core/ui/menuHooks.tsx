import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type { MenuItem, MenuItemsGetter } from './MenuTypes'
import type { PopupState } from './hooks'

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

// Cascading menu specific context and hooks

export const CascadingContext = createContext({
  rootPopupState: undefined as PopupState | undefined,
  openSubmenuId: undefined as string | undefined,
  setOpenSubmenuId: (() => {}) as (id: string | undefined) => void,
})

export function useCascadingContext(rootPopupState: PopupState) {
  const [openSubmenuId, setOpenSubmenuId] = useState<string | undefined>()

  return useMemo(
    () => ({
      rootPopupState,
      openSubmenuId,
      setOpenSubmenuId,
    }),
    [rootPopupState, openSubmenuId],
  )
}

export function useSubmenuContext() {
  const { rootPopupState } = useContext(CascadingContext)
  const [openSubmenuId, setOpenSubmenuId] = useState<string | undefined>()

  return useMemo(
    () => ({
      rootPopupState,
      openSubmenuId,
      setOpenSubmenuId,
    }),
    [rootPopupState, openSubmenuId],
  )
}

export function useSubmenuState(submenuId: string) {
  const { openSubmenuId, setOpenSubmenuId, rootPopupState } =
    useContext(CascadingContext)
  const isOpen = openSubmenuId === submenuId

  const open = useCallback(() => {
    setOpenSubmenuId(submenuId)
  }, [setOpenSubmenuId, submenuId])

  const close = useCallback(() => {
    if (openSubmenuId === submenuId) {
      setOpenSubmenuId(undefined)
    }
  }, [openSubmenuId, setOpenSubmenuId, submenuId])

  const closeAll = useCallback(() => {
    rootPopupState?.close()
  }, [rootPopupState])

  return { isOpen, open, close, closeAll }
}

export function useCloseSubmenu() {
  const { setOpenSubmenuId } = useContext(CascadingContext)
  return useCallback(() => {
    setOpenSubmenuId(undefined)
  }, [setOpenSubmenuId])
}
