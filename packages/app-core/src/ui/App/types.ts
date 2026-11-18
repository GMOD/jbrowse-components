import type { WorkspaceLayout } from '../../WorkspaceLayout/model.ts'
import type { Menu } from '../../menus.ts'
import type {
  ErrorDialogState,
  SnackbarMessage,
} from '@jbrowse/core/ui/SnackbarModel'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util'
import type { IsAny } from '@jbrowse/core/util/types'
import type {
  AssertNotAny,
  SessionWithMultipleViews,
} from '@jbrowse/product-core'

export { type Menu } from '../../menus.ts'

// What the toolbar's theme control reads. Every product mounting this toolbar
// composes ThemeManagerSessionMixin, so these are always there.
export interface ThemeSwitchSession {
  themeMode: 'light' | 'dark' | 'system'
  effectiveThemeMode: 'light' | 'dark'
  themeIsDark: boolean
  darkReaderDark: boolean
  systemThemeOverride?: 'light' | 'dark'
  setSystemThemeOverride: (mode?: 'light' | 'dark') => void
}

// The session the workspace and each view's chrome are mounted with: a list of
// views arranged by a workspace layout
export type WorkspaceSessionType = SessionWithFocusedViewAndDrawerWidgets &
  SessionWithMultipleViews &
  WorkspaceLayout

export type _WorkspaceSessionIsTyped = AssertNotAny<
  IsAny<WorkspaceSessionType | WorkspaceSessionType['moveViewToTop']>
>

// The app's own session: a workspace-drivable one plus the chrome around the
// views. An extension rather than a parallel list, since App hands the same
// session to ViewsContainer and on to the workspace.
export type AppSession = WorkspaceSessionType &
  ThemeSwitchSession & {
    menus: () => Menu[]
    errorDialog: ErrorDialogState | undefined
    setErrorDialog: (state: ErrorDialogState | undefined) => void
    renameCurrentSession: (arg: string) => void
    snackbarMessages: SnackbarMessage[]
    popSnackbarMessage: () => unknown
    removeActiveDialog: () => void
  }
