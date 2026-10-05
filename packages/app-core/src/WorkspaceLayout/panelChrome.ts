import type { PanelNode, TabNode } from './tree.ts'
import type { PointerGestureHandlers } from './usePointerGesture.ts'

/**
 * The app's half of a panel, as one object so it can be memoised: it reaches
 * every panel, and a fresh one re-renders the whole workspace.
 */
export interface PanelChrome {
  renderTabLabel: (tab: TabNode) => React.ReactNode
  renderTabContent: (tab: TabNode) => React.ReactNode
  renderPanelActions?: (panel: PanelNode) => React.ReactNode
  dragHandlers: PointerGestureHandlers
  /** middle-click; the caller pairs it with closing that tab's views */
  onTabClose?: (tabId: string) => void
}

export const tabDomId = (tabId: string) => `jbrowse-tab-${tabId}`
export const tabPanelDomId = (panelId: string) => `jbrowse-tabpanel-${panelId}`
