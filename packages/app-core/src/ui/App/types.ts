import type { Menu } from '../../menus.ts'
import type {
  ErrorDialogState,
  SnackbarMessage,
} from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'

export { type Menu } from '../../menus.ts'

// What a workspace needs of the session it drives. Named for dockview until the
// workspace stopped being dockview; nothing about the shape was ever its.
export type WorkspaceSessionType = SessionWithFocusedViewAndDrawerWidgets & {
  renameCurrentSession: (arg: string) => void
  snackbarMessages: SnackbarMessage[]
  popSnackbarMessage: () => unknown
  // `session.views` is the order views render in, so a layout that states an
  // order (a session spec's `layout`, which lists views per panel) applies it
  // there rather than in the panel assignments, which carry membership only
  orderViews: (ids: string[]) => void
}

// The app's own session, which is a workspace-drivable one plus the chrome
// around the views. Declared as an extension rather than a parallel list: App
// hands the same session to ViewsContainer and on to the workspace, so the two
// have to stay assignable, and they used to restate three members each to do it.
export type AppSession = WorkspaceSessionType & {
  menus: () => Menu[]
  errorDialog: ErrorDialogState | undefined
  setErrorDialog: (state: ErrorDialogState | undefined) => void
  effectiveUseWorkspaces: boolean
}
