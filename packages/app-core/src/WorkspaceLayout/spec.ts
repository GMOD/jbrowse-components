import { normalize } from './tree.ts'

import type { LayoutTree, PanelNode, TabNode } from './tree.ts'

/**
 * The `layout` a session spec / URL param states, in the vocabulary users
 * write it in. **This shape is public** — it is documented as a URL parameter —
 * so it keeps `horizontal`/`vertical`/`tabs` and percentage `size` rather than
 * being renamed to match the internal tree.
 */
export interface LayoutSpecNode {
  /** a leaf: the views to stack vertically in one tab */
  viewIds?: string[]
  /** how children divide the space; `tabs` puts them in one cell as tabs */
  direction?: 'horizontal' | 'vertical' | 'tabs'
  children?: LayoutSpecNode[]
  /** share of the parent, as a percentage */
  size?: number
}

/** A request to move one view relative to the others. Public plugin API. */
export interface PendingMove {
  type: 'newTab' | 'splitRight'
  viewId: string
}

/**
 * Build a layout tree from a spec.
 *
 * The old converter had to answer "which dockview group does a nested split
 * address?" and could not, because dockview forces orientation to alternate by
 * depth — which is why `size` was honoured only on the top-level split, and
 * only if every panel there carried one. Here the spec's nesting is the tree's
 * nesting, so `size` applies wherever it is written and there is no all-or-
 * nothing pass.
 */
export function treeFromSpec(
  spec: LayoutSpecNode,
  nextId: (kind: 'panel' | 'tab') => string,
): LayoutTree {
  function build(node: LayoutSpecNode): LayoutTree | undefined {
    const size = node.size ?? 1
    if (node.viewIds) {
      return {
        id: nextId('panel'),
        size,
        tabs: [{ id: nextId('tab'), viewIds: [...node.viewIds] }],
        activeTabId: undefined,
      } satisfies PanelNode
    }
    const children = node.children ?? []
    if (children.length === 0) {
      return undefined
    }
    // `tabs` is not a split: every child's views become a tab in one cell
    if (node.direction === 'tabs') {
      const tabs: TabNode[] = children.flatMap(child =>
        child.viewIds
          ? [{ id: nextId('tab'), viewIds: [...child.viewIds] }]
          : [],
      )
      return {
        id: nextId('panel'),
        size,
        tabs,
        activeTabId: tabs[0]?.id,
      }
    }
    const built = children.flatMap(child => {
      const node = build(child)
      return node ? [node] : []
    })
    return built.length === 0
      ? undefined
      : {
          id: nextId('panel') /* replaced below when it stays a branch */,
          size,
          direction: node.direction === 'vertical' ? 'column' : 'row',
          children: built,
        }
  }

  const root = build(spec)
  return root ? normalize(root) : { id: nextId('panel'), size: 1, tabs: [] }
}

/** Every viewId a spec names, depth-first — the order it states. */
export function viewIdsInSpec(spec: LayoutSpecNode): string[] {
  return [
    ...(spec.viewIds ?? []),
    ...(spec.children ?? []).flatMap(viewIdsInSpec),
  ]
}

/**
 * `setPendingMove` as a spec: everything else keeps its side, the named view
 * takes the other. With nothing else on screen there is nothing to split from,
 * so the view just takes the space.
 */
export function specForPendingMove(
  move: PendingMove,
  allViewIds: string[],
): LayoutSpecNode {
  const others = allViewIds.filter(id => id !== move.viewId)
  return others.length > 0
    ? {
        direction: move.type === 'splitRight' ? 'horizontal' : 'tabs',
        children: [{ viewIds: others }, { viewIds: [move.viewId] }],
      }
    : { viewIds: [move.viewId] }
}
