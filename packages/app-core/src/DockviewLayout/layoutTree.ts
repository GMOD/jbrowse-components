import { types } from '@jbrowse/mobx-state-tree'

import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel LayoutPanel
 * One dockview tab. `viewIds` is the vertical stack of views the tab renders.
 */
export const LayoutPanel = types.model('LayoutPanel', {
  id: types.string,
  viewIds: types.array(types.string),
  /**
   * #property
   * User-renamed tab title; falls back to a derived label when undefined
   */
  title: types.maybe(types.string),
})

/**
 * #stateModel LayoutLeaf
 * One dockview group (tab group): a set of panels shown as switchable tabs.
 */
export const LayoutLeaf = types.model('LayoutLeaf', {
  type: types.literal('leaf'),
  id: types.string,
  panels: types.array(LayoutPanel),
  activePanelId: types.maybe(types.string),
  /**
   * #property
   * Pixel size of this group along its parent branch's direction
   */
  size: types.maybe(types.number),
})

/**
 * #stateModel LayoutBranch
 * A split container. `direction` is the orientation of the root branch; dockview
 * derives nested orientations by depth, so only the root direction is serialized.
 */
export const LayoutBranch = types.model('LayoutBranch', {
  type: types.literal('branch'),
  direction: types.enumeration('LayoutDirection', ['row', 'column']),
  size: types.maybe(types.number),
  children: types.array(types.late((): IAnyType => LayoutNode)),
})

export const LayoutNode = types.union(
  {
    dispatcher: (snap: { type: string }) =>
      snap.type === 'branch' ? LayoutBranch : LayoutLeaf,
  },
  LayoutBranch,
  LayoutLeaf,
)

export type LayoutPanelInstance = Instance<typeof LayoutPanel>
export type LayoutLeafInstance = Instance<typeof LayoutLeaf>
export type LayoutBranchInstance = Instance<typeof LayoutBranch>
export type LayoutNodeInstance = LayoutLeafInstance | LayoutBranchInstance

/**
 * Plain (non-MST) snapshot shapes. The pure mapping functions in `mapping.ts`
 * build and read these directly, keeping them independent of MST.
 */
export interface PanelSnapshot {
  id: string
  viewIds: string[]
  title?: string
}
export interface LeafSnapshot {
  type: 'leaf'
  id: string
  panels: PanelSnapshot[]
  activePanelId?: string
  size?: number
}
export interface BranchSnapshot {
  type: 'branch'
  direction: 'row' | 'column'
  size?: number
  children: NodeSnapshot[]
}
export type NodeSnapshot = LeafSnapshot | BranchSnapshot

/** Run `fn` over every leaf reachable from `node`, depth-first. */
export function eachLeaf(
  node: LayoutNodeInstance,
  fn: (leaf: LayoutLeafInstance) => void,
) {
  if (node.type === 'leaf') {
    fn(node)
  } else {
    for (const child of node.children) {
      eachLeaf(child, fn)
    }
  }
}

/** Collect all leaves (tab groups) under `root` in depth-first order. */
export function collectLeaves(
  root: LayoutNodeInstance | undefined,
): LayoutLeafInstance[] {
  const out: LayoutLeafInstance[] = []
  if (root) {
    eachLeaf(root, leaf => {
      out.push(leaf)
    })
  }
  return out
}

/** Collect all panels (tabs) under `root` in depth-first order. */
export function collectPanels(
  root: LayoutNodeInstance | undefined,
): LayoutPanelInstance[] {
  return collectLeaves(root).flatMap(leaf => [...leaf.panels])
}

/** Find a panel by id anywhere in the tree. */
export function findPanel(
  root: LayoutNodeInstance | undefined,
  panelId: string,
): LayoutPanelInstance | undefined {
  return collectPanels(root).find(panel => panel.id === panelId)
}

/** Find the leaf (tab group) that directly contains `panelId`. */
export function findLeafOfPanel(
  root: LayoutNodeInstance | undefined,
  panelId: string,
): LayoutLeafInstance | undefined {
  return collectLeaves(root).find(leaf =>
    leaf.panels.some(panel => panel.id === panelId),
  )
}

/** Find the panel whose view stack contains `viewId`. */
export function findPanelOfView(
  root: LayoutNodeInstance | undefined,
  viewId: string,
): LayoutPanelInstance | undefined {
  return collectPanels(root).find(panel => panel.viewIds.includes(viewId))
}
