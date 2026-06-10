import type { Menu } from '../menus.ts'
import type { AssemblyManager } from '@jbrowse/core/util/types'

/**
 * Contract a root model must satisfy to host an "app" session (the surface
 * {@link AppSessionMixin} delegates to via `self.root`). Every app-product root
 * — built from `BaseRootModelFactory` + `HistoryManagementMixin` +
 * `RootAppMenuMixin` — satisfies this structurally.
 *
 * Product-specific root contracts (e.g. web-core's `AbstractWebRootModel`)
 * extend this with their extra surface rather than re-declaring these members.
 */
export interface AppRootModel {
  readonly version: string
  readonly assemblyManager: AssemblyManager
  /**
   * Undo/redo time-traveller. Optional: full app shells (desktop, jbrowse-web)
   * compose `HistoryManagementMixin` and provide it; the embedded react-app root
   * intentionally omits undo/redo (no global keydown listener / snapshot
   * tracking), so its root has no `history`.
   */
  readonly history?: {
    canUndo: boolean
    canRedo: boolean
    undo(): void
    redo(): void
  }
  menus(): Menu[]
  renameCurrentSession(name: string): void
}
