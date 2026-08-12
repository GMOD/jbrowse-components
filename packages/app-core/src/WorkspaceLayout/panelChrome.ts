import type { PanelNode, TabNode } from './tree.ts'
import type { TabDragHandlers } from './useLayoutDrag.ts'

/**
 * The app's half of a panel — what a tab is *called* and what it *contains*.
 *
 * One object rather than five props because every one is forwarded unchanged
 * down the whole recursion, and because one object can be memoised: it reaches
 * every panel, so a fresh one per render re-renders the entire workspace.
 */
export interface PanelChrome {
  renderTabLabel: (tab: TabNode) => React.ReactNode
  renderTabContent: (tab: TabNode) => React.ReactNode
  renderPanelActions?: (panel: PanelNode) => React.ReactNode
  dragHandlers: TabDragHandlers
  /** middle-click; the caller pairs it with closing that tab's views */
  onTabClose?: (tabId: string) => void
}

// The tablist wires `aria-controls`/`aria-labelledby` with these, and the strip
// mints one end of each pair while the tabpanel mints the other.
export const tabDomId = (tabId: string) => `jbrowse-tab-${tabId}`
export const tabPanelDomId = (panelId: string) => `jbrowse-tabpanel-${panelId}`
