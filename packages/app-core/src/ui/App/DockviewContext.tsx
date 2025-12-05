import { createContext, useContext } from 'react'

import type { DockviewApi } from 'dockview-react'

interface DockviewContextValue {
  api: DockviewApi | null
  rearrangePanels: (arrange: (api: DockviewApi) => void) => void
  addEmptyTab: () => void
}

export const DockviewContext = createContext<DockviewContextValue>({
  api: null,
  rearrangePanels: () => {},
  addEmptyTab: () => {},
})

export function useDockview() {
  return useContext(DockviewContext)
}
