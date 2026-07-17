import { createContext, use } from 'react'

import type { DockviewSessionType } from './types.ts'
import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'
import type { DockviewApi, DockviewGroupPanel } from 'dockview-react'

export interface DockviewContextValue {
  api: DockviewApi | null
  // The live MST session, supplied to dockview's portaled panel/tab components
  // via context rather than through serialized panel params (which would embed
  // a circular session snapshot in the persisted layout). Undefined only in the
  // no-op default below, where no panel ever renders.
  session?: DockviewSessionType & SessionWithDockviewLayout
  rearrangePanels: (arrange: (api: DockviewApi) => void) => void
  addEmptyTab: (targetGroup?: DockviewGroupPanel) => void
  moveViewToNewTab: (viewId: string) => void
  moveViewToSplitRight: (viewId: string) => void
}

// Defaults are no-ops: before the dockview container mounts there are no panels
// to move into, so ViewMenu queues the move on the session via setPendingMove
// instead (see TiledViewsContainer's onReady). ViewMenu reads this default in
// classic (non-workspace) mode, where there is no provider.
export const DockviewContext = createContext<DockviewContextValue>({
  api: null,
  session: undefined,
  rearrangePanels: () => {},
  addEmptyTab: () => {},
  moveViewToNewTab: () => {},
  moveViewToSplitRight: () => {},
})

export function useDockview() {
  return use(DockviewContext)
}
