import { normalize } from './tree.ts'

import type { LayoutTree, NodeKind, PanelNode, TabNode } from './tree.ts'

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
 * The effective size of each child of one branch.
 *
 * `size` is documented as a **percentage**, so a spec that sizes some siblings
 * and leaves the rest bare means the rest to share what is left over: `70` and
 * blank is 70/30. Defaulting a bare sibling to 1 instead reads a weight against
 * a percentage, and the panel comes out at 1/71 of the width — present, about a
 * pixel wide, and reported by nothing.
 *
 * The mixed case used to be unreachable: dockview forced orientation to
 * alternate by depth, so the converter discarded any partially-sized branch
 * wholesale and raised a notification saying so. Nesting works now, which means
 * this has to mean something instead.
 *
 * All-sized and none-sized both stay plain weights — `normalize` renormalises
 * them, so `70`/`30` and `7`/`3` are the same layout and neither has to sum to
 * anything in particular.
 */
function resolveSizes(children: LayoutSpecNode[]): number[] {
  const stated = children.map(child => child.size)
  const named = stated.filter(size => size !== undefined)
  if (named.length === 0 || named.length === children.length) {
    return stated.map(size => size ?? 1)
  }
  const claimed = named.reduce((a, b) => a + b, 0)
  const remainder = 100 - claimed
  const share =
    remainder > 0
      ? remainder / (children.length - named.length)
      : // an over-subscribed branch has nothing left to hand out, so a bare
        // sibling takes a typical share rather than collapsing to nothing
        claimed / named.length
  return stated.map(size => size ?? share)
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
  nextId: (kind: NodeKind) => string,
): LayoutTree {
  function build(node: LayoutSpecNode, size: number): LayoutTree | undefined {
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
    // `tabs` is not a split: every child's views become a tab in one cell.
    //
    // A tab holds a FLAT stack of views, so a container child has no split to
    // become — and the docs say containers nest arbitrarily deep, so one can be
    // written. Its views are flattened into a single tab; they used to be
    // dropped from the layout outright, which is invisible rather than wrong,
    // since homing then swept them into whichever tab happened to be showing.
    // `loadSessionSpec` reports the flattening, as it does the sizes below.
    if (node.direction === 'tabs') {
      const tabs: TabNode[] = children.flatMap(child => {
        const viewIds = viewIdsInSpec(child)
        return child.viewIds === undefined && viewIds.length === 0
          ? []
          : [{ id: nextId('tab'), viewIds }]
      })
      return {
        id: nextId('panel'),
        size,
        tabs,
        activeTabId: tabs[0]?.id,
      }
    }
    const sizes = resolveSizes(children)
    const built = children.flatMap((child, i) => {
      const subtree = build(child, sizes[i]!)
      return subtree ? [subtree] : []
    })
    return built.length === 0
      ? undefined
      : {
          id: nextId('branch'),
          size,
          direction: node.direction === 'vertical' ? 'column' : 'row',
          children: built,
        }
  }

  const root = build(spec, spec.size ?? 1)
  return root ? normalize(root) : { id: nextId('panel'), size: 1, tabs: [] }
}

/** Every viewId a spec names, depth-first — the order it states. */
export function viewIdsInSpec(spec: LayoutSpecNode): string[] {
  return [
    ...(spec.viewIds ?? []),
    ...(spec.children ?? []).flatMap(viewIdsInSpec),
  ]
}

/** How "arrange everything" lays the whole session out. */
export type TileMode = 'tabs' | 'horizontal' | 'vertical' | 'grid'

/**
 * Re-arrange every view at once, one view per cell.
 *
 * The four whole-workspace commands, as a spec. dockview had these as imperative
 * re-tiling — walk every panel and re-add it relative to the first, in an order
 * chosen so the grid came out right — and the grid case had to compute its own
 * row/column arithmetic against `api.panels` because there was no way to state
 * the shape. Here the shape IS the statement, so a tiling is a spec and goes
 * through the same `applyLayoutSpec` a session spec does.
 *
 * `grid` fills row-major at ceil(sqrt(n)) columns, which is what the dockview
 * version computed; a trailing row shorter than the rest keeps its cells at full
 * width, since `resolveSizes` reads bare siblings as an even share of their own
 * branch rather than of the grid.
 */
export function tileLayoutSpec(
  viewIds: string[],
  mode: TileMode,
): LayoutSpecNode {
  // Nothing to arrange: one view is the whole workspace whatever the mode, and
  // no views leaves the empty panel the tree already guarantees.
  if (viewIds.length <= 1) {
    return { viewIds: [...viewIds] }
  }
  const cell = (id: string): LayoutSpecNode => ({ viewIds: [id] })
  if (mode !== 'grid') {
    return { direction: mode, children: viewIds.map(cell) }
  }
  const cols = Math.ceil(Math.sqrt(viewIds.length))
  const rows: LayoutSpecNode[] = []
  for (let i = 0; i < viewIds.length; i += cols) {
    rows.push({
      direction: 'horizontal',
      children: viewIds.slice(i, i + cols).map(cell),
    })
  }
  return { direction: 'vertical', children: rows }
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
