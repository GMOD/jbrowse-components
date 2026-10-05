import { normalize } from './tree.ts'

import type { LayoutTree, NodeKind, PanelNode, TabNode } from './tree.ts'

/**
 * A view named by a layout leaf: an index into the view list the layout is
 * applied against (a session spec's own `views`, or `session.views` for the
 * live `applyLayoutSpec`), or a view id.
 */
export type LayoutViewRef = number | string

/**
 * The `layout` a session spec or URL param states, and the shape
 * `applyLayoutSpec` takes. Public, documented as a URL parameter, so it keeps
 * `horizontal`/`vertical`/`tabs` and percentage `size` rather than the
 * internal tree's vocabulary.
 */
export interface LayoutSpecNode<View = LayoutViewRef> {
  /** a leaf: the views to stack vertically in one tab */
  views?: View[]
  /** how children divide the space; `tabs` puts them in one cell as tabs */
  direction?: 'horizontal' | 'vertical' | 'tabs'
  children?: LayoutSpecNode<View>[]
  /** share of the parent, as a percentage */
  size?: number
}

export type ResolvedLayoutSpecNode = LayoutSpecNode<string>

const layoutNodeKeys = new Set(['views', 'direction', 'children', 'size'])

/**
 * Resolve every view a spec names to an id against `allViewIds`, the list its
 * indexes count into. An unknown key, index or id throws, naming what was
 * received, so an untyped caller writing `viewIds` for `views` hears about it.
 * A node with neither `views` nor `children` is a legal empty panel.
 *
 * `allViewIds` is undefined only on a model that composes no view list.
 */
export function resolveLayoutSpec(
  spec: LayoutSpecNode,
  allViewIds: string[] | undefined,
): ResolvedLayoutSpecNode {
  const describe = (value: unknown) =>
    typeof value === 'string' ? `"${value}"` : String(value)
  const resolveRef = (ref: unknown) => {
    if (typeof ref === 'number') {
      if (!allViewIds) {
        throw new Error(
          `Layout names view index ${ref}, but this session has no view list for an index to count into; name the view by id`,
        )
      }
      const id = allViewIds[ref]
      if (id === undefined) {
        throw new Error(
          `Layout names view index ${ref}, but the session has ${allViewIds.length} view(s)${allViewIds.length ? ` (indexes 0-${allViewIds.length - 1})` : ''}`,
        )
      }
      return id
    }
    if (typeof ref !== 'string') {
      throw new Error(
        `Layout "views" entries are view indexes or view ids; received ${describe(ref)}`,
      )
    }
    if (allViewIds && !allViewIds.includes(ref)) {
      throw new Error(
        `Layout names view id ${describe(ref)}, which is not a view in this session (ids: ${allViewIds.map(describe).join(', ') || 'none'})`,
      )
    }
    return ref
  }
  const resolveNode = (node: LayoutSpecNode): ResolvedLayoutSpecNode => {
    const { views, children, ...rest } = node
    const unknown = Object.keys(rest).filter(key => !layoutNodeKeys.has(key))
    if (unknown.length > 0) {
      throw new Error(
        `Layout node has unrecognized key(s) ${unknown.map(describe).join(', ')}; a leaf names its views with "views" (view indexes or ids) and a container nests "children"`,
      )
    }
    if (views !== undefined && !Array.isArray(views)) {
      throw new Error(
        `Layout "views" is an array of view indexes or ids; received ${describe(views)}`,
      )
    }
    if (children !== undefined && !Array.isArray(children)) {
      throw new Error(
        `Layout "children" is an array of layout nodes; received ${describe(children)}`,
      )
    }
    return {
      ...rest,
      ...(views === undefined ? {} : { views: views.map(resolveRef) }),
      ...(children === undefined
        ? {}
        : { children: children.map(resolveNode) }),
    }
  }
  const resolved = resolveNode(spec)
  const seen = new Set<string>()
  const repeated = new Set(
    viewIdsInSpec(resolved).filter(id => {
      const already = seen.has(id)
      seen.add(id)
      return already
    }),
  )
  if (repeated.size > 0) {
    throw new Error(
      `Layout seats view ${[...repeated].map(describe).join(', ')} in more than one cell; a view lives in exactly one tab, so name it once`,
    )
  }
  return resolved
}

/** A request to move one view relative to the others. Public plugin API. */
export interface PendingMove {
  type: 'newTab' | 'splitRight'
  viewId: string
}

/**
 * `size` is a percentage, so bare siblings share what the sized ones leave:
 * `70` and blank is 70/30, not a 1/71 sliver. All-sized and none-sized stay
 * plain weights for `normalize`.
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
      : // over-subscribed: a bare sibling takes an average share
        claimed / named.length
  return stated.map(size => size ?? share)
}

export function treeFromSpec(
  spec: ResolvedLayoutSpecNode,
  nextId: (kind: NodeKind) => string,
): LayoutTree {
  function build(
    node: ResolvedLayoutSpecNode,
    size: number,
  ): LayoutTree | undefined {
    if (node.views) {
      return {
        id: nextId('panel'),
        size,
        tabs: [{ id: nextId('tab'), viewIds: [...node.views] }],
        activeTabId: undefined,
      } satisfies PanelNode
    }
    const children = node.children ?? []
    if (children.length === 0) {
      return undefined
    }
    // every child becomes a tab in one cell; a tab holds a flat stack, so a
    // container child's views flatten into it (`loadSessionSpec` reports this)
    if (node.direction === 'tabs') {
      const tabs: TabNode[] = children.flatMap(child => {
        const viewIds = viewIdsInSpec(child)
        return child.views === undefined && viewIds.length === 0
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
export function viewIdsInSpec(spec: ResolvedLayoutSpecNode): string[] {
  return [
    ...(spec.views ?? []),
    ...(spec.children ?? []).flatMap(viewIdsInSpec),
  ]
}

/** How "arrange everything" lays the whole session out. */
export type TileMode = 'tabs' | 'horizontal' | 'vertical' | 'grid'

/**
 * One view per cell, as a spec. `grid` fills row-major at ceil(sqrt(n))
 * columns; a short trailing row's cells stretch to full width.
 */
export function tileLayoutSpec(
  viewIds: string[],
  mode: TileMode,
): ResolvedLayoutSpecNode {
  if (viewIds.length <= 1) {
    return { views: [...viewIds] }
  }
  const cell = (id: string): ResolvedLayoutSpecNode => ({ views: [id] })
  if (mode !== 'grid') {
    return { direction: mode, children: viewIds.map(cell) }
  }
  const cols = Math.ceil(Math.sqrt(viewIds.length))
  const rows: ResolvedLayoutSpecNode[] = []
  for (let i = 0; i < viewIds.length; i += cols) {
    rows.push({
      direction: 'horizontal',
      children: viewIds.slice(i, i + cols).map(cell),
    })
  }
  return { direction: 'vertical', children: rows }
}
