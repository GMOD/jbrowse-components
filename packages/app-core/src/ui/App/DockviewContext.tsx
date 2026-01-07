import { createContext, useContext } from 'react'

import type { DockviewApi, DockviewGroupPanel } from 'dockview-react'

interface DockviewContextValue {
  api: DockviewApi | null
  rearrangePanels: (arrange: (api: DockviewApi) => void) => void
  addEmptyTab: (targetGroup?: DockviewGroupPanel) => void
  moveViewToNewTab: (viewId: string) => void
  moveViewToSplitRight: (viewId: string) => void
}

// Pending action stored when workspaces not yet enabled
let pendingMoveAction: {
  type: 'newTab' | 'splitRight'
  viewId: string
} | null = null

export function getPendingMoveAction() {
  const action = pendingMoveAction
  pendingMoveAction = null
  return action
}

export const DockviewContext = createContext<DockviewContextValue>({
  api: null,
  rearrangePanels: () => {},
  addEmptyTab: () => {},
  moveViewToNewTab: (viewId: string) => {
    pendingMoveAction = { type: 'newTab', viewId }
  },
  moveViewToSplitRight: (viewId: string) => {
    pendingMoveAction = { type: 'splitRight', viewId }
  },
})

export function useDockview() {
  return useContext(DockviewContext)
}
