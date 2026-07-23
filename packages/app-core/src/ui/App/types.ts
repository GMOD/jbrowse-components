import type { Menu } from '../../menus.ts'
import type {
  ErrorDialogState,
  SnackbarMessage,
} from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

export { type Menu } from '../../menus.ts'

export type AppSession = SessionWithFocusedViewAndDrawerWidgets & {
  menus: () => Menu[]
  snackbarMessages: SnackbarMessage[]
  errorDialog: ErrorDialogState | undefined
  setErrorDialog: (state: ErrorDialogState | undefined) => void
  renameCurrentSession: (arg: string) => void
  popSnackbarMessage: () => unknown
  effectiveUseWorkspaces: boolean
}

export type DockviewSessionType = SessionWithFocusedViewAndDrawerWidgets & {
  renameCurrentSession: (arg: string) => void
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => unknown
}

export interface JBrowseViewPanelParams {
  panelId: string
}
