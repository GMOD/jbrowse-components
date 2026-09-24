import type { Menu } from '../../menus.ts'
import type {
  ErrorDialogState,
  SnackbarMessage,
} from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

export { type Menu } from '../../menus.ts'

// What a workspace needs of the session it drives
export type WorkspaceSessionType = SessionWithFocusedViewAndDrawerWidgets

// The app's own session: a workspace-drivable one plus the chrome around the
// views. An extension rather than a parallel list, since App hands the same
// session to ViewsContainer and on to the workspace.
export type AppSession = WorkspaceSessionType & {
  menus: () => Menu[]
  errorDialog: ErrorDialogState | undefined
  setErrorDialog: (state: ErrorDialogState | undefined) => void
  effectiveUseWorkspaces: boolean
  renameCurrentSession: (arg: string) => void
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => unknown
}
