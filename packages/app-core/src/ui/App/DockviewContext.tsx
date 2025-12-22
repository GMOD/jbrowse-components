import { createContext, useContext } from 'react'

import type { DockviewApi, DockviewGroupPanel } from 'dockview-react'

interface DockviewContextValue {
  api: DockviewApi | null
  rearrangePanels: (arrange: (api: DockviewApi) => void) => void
  addEmptyTab: (targetGroup?: DockviewGroupPanel) => void
  moveViewToNewTab: (viewId: string) => void
}

export const DockviewContext = createContext<DockviewContextValue>({
  api: null,
  rearrangePanels: () => {},
  addEmptyTab: () => {},
  moveViewToNewTab: () => {},
})

export function useDockview() {
  return useContext(DockviewContext)
}
