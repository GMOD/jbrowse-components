import type { MenuItem as JBMenuItem } from '@jbrowse/core/ui'
import type { SnackbarMessage } from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

export interface Menu {
  label: string
  menuItems: JBMenuItem[] | (() => JBMenuItem[])
}

export type AppSession = SessionWithFocusedViewAndDrawerWidgets & {
  menus: () => Menu[]
  snackbarMessages: SnackbarMessage[]
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
  useWorkspaces: boolean
}

export type DockviewSessionType = SessionWithFocusedViewAndDrawerWidgets & {
  renameCurrentSession: (arg: string) => void
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => unknown
}
