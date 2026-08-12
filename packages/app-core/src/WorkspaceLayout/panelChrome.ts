import type { PanelNode, TabNode } from './tree.ts'
import type { TabDragHandlers } from './useLayoutDrag.ts'

/**
 * The app's half of a panel.
 *
 * The grid, the strip and the splitters are layout and are drawn here; what a
 * tab is *called* and what it *contains* are JBrowse's, and arrive as these
 * render props. That split is why `LayoutRenderer` and everything under it
 * knows nothing about views, assemblies or sessions.
 *
 * Bundled rather than spelled out as six props because every one of them is
 * forwarded unchanged down the whole recursion — a branch hands them to its
 * children, a panel hands them to its strip — so listing them at each hop is
 * the same list written four times, and the copies drift.
 */
export interface PanelChrome {
  /** the label inside a tab: the app's name for it, plus its ⋮ menu */
  renderTabLabel: (tab: TabNode) => React.ReactNode
  /** what the shown tab holds — a stack of views, or the view launcher */
  renderTabContent: (tab: TabNode) => React.ReactNode
  /** the cell's own buttons: new tab, split, close */
  renderPanelActions?: (panel: PanelNode) => React.ReactNode
  dragHandlers: TabDragHandlers
  /**
   * Middle-click on a tab. The layout does not own views, so the caller pairs
   * this with closing that tab's views — see `WorkspaceContainer.closeTab`.
   */
  onTabClose?: (tabId: string) => void
}

/**
 * The tab strip is a `tablist`, so the ids it wires `aria-controls` /
 * `aria-labelledby` with have to be DOM ids. Tab and panel ids are
 * `types.identifier` and so unique within the tree, which is what makes
 * prefixing them enough.
 *
 * Here rather than beside either user: the strip mints one end of each pair and
 * the tabpanel mints the other, so a copy in each file is two halves of one
 * contract that nothing checks agree.
 */
export const tabDomId = (tabId: string) => `jbrowse-tab-${tabId}`
export const tabPanelDomId = (panelId: string) => `jbrowse-tabpanel-${panelId}`
