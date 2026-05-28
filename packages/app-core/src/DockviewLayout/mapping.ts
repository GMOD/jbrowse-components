import { Orientation } from 'dockview-react'

import type {
  BranchSnapshot,
  LeafSnapshot,
  NodeSnapshot,
  PanelSnapshot,
} from './layoutTree.ts'
import type { GroupviewPanelState, SerializedDockview } from 'dockview-react'

// Registered dockview component names (see createPanelConfig).
const CONTENT_COMPONENT = 'jbrowseView'
const TAB_COMPONENT = 'jbrowseTab'

// The dockview group-grid node type, named via indexed access since dockview
// does not export `GroupPanelViewState` from its package entrypoint.
type GridObject = SerializedDockview['grid']['root']

/** Walk a snapshot tree collecting panelId -> viewIds (for writeback re-attach). */
export function viewIdMapFromTree(
  root: NodeSnapshot | undefined,
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  function walk(node: NodeSnapshot) {
    if (node.type === 'branch') {
      for (const child of node.children) {
        walk(child)
      }
    } else {
      for (const panel of node.panels) {
        map.set(panel.id, panel.viewIds)
      }
    }
  }
  if (root) {
    walk(root)
  }
  return map
}

function leafIdOfPanel(
  root: NodeSnapshot,
  panelId: string,
): string | undefined {
  let leafId: string | undefined
  function walk(node: NodeSnapshot) {
    if (node.type === 'branch') {
      for (const child of node.children) {
        walk(child)
      }
    } else if (node.panels.some(panel => panel.id === panelId)) {
      leafId = node.id
    }
  }
  walk(root)
  return leafId
}

/**
 * Build a dockview `SerializedDockview` from our layout tree snapshot. View ids
 * are not part of the dockview blob (they live only in MST); `panel.params` is
 * blanked so the live session is never serialized into the layout.
 */
export function treeToSerialized(
  root: NodeSnapshot,
  dims: { width: number; height: number },
  activePanelId?: string,
): SerializedDockview {
  const panels: Record<string, GroupviewPanelState> = {}

  function buildGrid(node: NodeSnapshot): GridObject {
    if (node.type === 'branch') {
      return {
        type: 'branch',
        data: node.children.map(buildGrid),
        ...(node.size === undefined ? {} : { size: node.size }),
      }
    }
    for (const panel of node.panels) {
      panels[panel.id] = {
        id: panel.id,
        contentComponent: CONTENT_COMPONENT,
        tabComponent: TAB_COMPONENT,
        params: {},
        ...(panel.title === undefined ? {} : { title: panel.title }),
      }
    }
    return {
      type: 'leaf',
      data: {
        id: node.id,
        views: node.panels.map(panel => panel.id),
        ...(node.activePanelId === undefined
          ? {}
          : { activeView: node.activePanelId }),
      },
      ...(node.size === undefined ? {} : { size: node.size }),
    }
  }

  const gridRoot = buildGrid(root)
  const orientation =
    root.type === 'branch' && root.direction === 'column'
      ? Orientation.VERTICAL
      : Orientation.HORIZONTAL
  const activeGroup =
    activePanelId === undefined ? undefined : leafIdOfPanel(root, activePanelId)

  return {
    grid: { root: gridRoot, width: dims.width, height: dims.height, orientation },
    panels,
    ...(activeGroup === undefined ? {} : { activeGroup }),
  }
}

/**
 * Parse a dockview `SerializedDockview` back into our layout tree snapshot.
 * Branch orientation alternates by depth (dockview only stores the root
 * orientation). `prevViewIds` re-attaches each panel's view stack by panel id,
 * since dockview's blob carries no view ids.
 */
export function serializedToTree(
  json: SerializedDockview,
  prevViewIds: Map<string, string[]>,
): NodeSnapshot {
  const { grid, panels } = json

  function parse(obj: GridObject, direction: 'row' | 'column'): NodeSnapshot {
    if (Array.isArray(obj.data)) {
      const childDirection = direction === 'row' ? 'column' : 'row'
      const branch: BranchSnapshot = {
        type: 'branch',
        direction,
        children: obj.data.map(child => parse(child, childDirection)),
        ...(obj.size === undefined ? {} : { size: obj.size }),
      }
      return branch
    }
    const data = obj.data
    const panelList: PanelSnapshot[] = data.views.map(panelId => {
      const title = panels[panelId]?.title
      return {
        id: panelId,
        viewIds: prevViewIds.get(panelId) ?? [],
        ...(title === undefined ? {} : { title }),
      }
    })
    const leaf: LeafSnapshot = {
      type: 'leaf',
      id: data.id,
      panels: panelList,
      ...(data.activeView === undefined ? {} : { activePanelId: data.activeView }),
      ...(obj.size === undefined ? {} : { size: obj.size }),
    }
    return leaf
  }

  const rootDirection =
    grid.orientation === Orientation.VERTICAL ? 'column' : 'row'
  return parse(grid.root, rootDirection)
}
