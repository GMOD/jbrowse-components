import { createContext, use } from 'react'

import type { MenuItemClickHandler } from './MenuTypes.ts'

/**
 * What every level of one cascading menu shares. A context rather than props
 * because a menu nests to any depth: each level threaded all four down to the
 * next, and a row three levels in needed them only to hand them on again.
 */
export interface CascadingMenuShared {
  /** whether clicking a row dismisses the whole menu; see `staysOpenOnClick` */
  closeAfterItemClick: boolean
  /**
   * How a row's onClick is invoked, at every depth — the menu itself never
   * calls it. A caller whose items expect a context argument supplies it here
   * (`cb => { cb(session) }`) rather than rewriting the items to close over it.
   */
  onMenuItemClick: (callback: MenuItemClickHandler) => void
  /** dismisses the root menu, from any depth */
  onCloseRoot: () => void
  /**
   * The root menu's stacking level, carried down to every submenu portal. Each
   * level is its own MUI Menu, so a submenu left on MUI's default modal z-index
   * sits UNDER a root that was raised off that scale (ContextMenu clears the
   * tooltip layer) — and the root's modal spans the viewport, so its backdrop
   * takes every click and hover the submenu rows never see. Undefined leaves
   * MUI's default, which is what a menu opened from a button wants.
   */
  zIndex?: React.CSSProperties['zIndex']
}

export const CascadingMenuContext = createContext<
  CascadingMenuShared | undefined
>(undefined)

export function useCascadingMenu() {
  const shared = use(CascadingMenuContext)
  if (!shared) {
    throw new Error('menu row rendered outside a CascadingMenu')
  }
  return shared
}

// The level for a portal a row opens (a help dialog, a disabled row's tooltip):
// above the menu, which outside a raised menu means MUI's own default
export function useAboveMenuZIndex() {
  const { zIndex } = useCascadingMenu()
  return typeof zIndex === 'number' ? zIndex + 1 : zIndex
}
