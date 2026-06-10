import type { Menu } from '../menus.ts'
import type { AssemblyManager } from '@jbrowse/core/util/types'

/**
 * Contract a root model must satisfy to host an "app" session (the surface
 * {@link AppSessionMixin} delegates to via `self.root`). Every app-product root
 * — built from `BaseRootModelFactory` + `HistoryManagementMixin` +
 * `RootAppMenuMixin` — satisfies this structurally.
 *
 * Product-specific root interfaces (e.g. web-core's `WebRootModelInterface`)
 * extend this with their extra surface rather than re-declaring these members.
 */
export interface AppRootModel {
  readonly version: string
  readonly assemblyManager: AssemblyManager
  readonly history: {
    canUndo: boolean
    canRedo: boolean
    undo(): void
    redo(): void
  }
  menus(): Menu[]
  renameCurrentSession(name: string): void
}
