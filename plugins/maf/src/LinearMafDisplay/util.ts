import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'
import {
  assignDepthY,
  eachAfter,
  leaves,
  maxLength,
  setBrLength,
} from '@jbrowse/tree-sidebar'

import type { HierarchyNode } from '@jbrowse/tree-sidebar'

/**
 * Compute both depth-based (`.y`) and branch-length-based (`.len`) x positions
 * on a MAF tree. The view toggles between the two via `showBranchLen`.
 *
 * Leaves are placed at fixed `rowHeight` multiples (matching the renderer's
 * row positioning); internal-node x is the midpoint of first/last child.
 */
export function layoutMafTree<T extends { length?: number }>(
  root: HierarchyNode<T>,
  width: number,
  rowHeight: number,
) {
  assignDepthY(root, width)

  const leafNodes = leaves(root)
  for (let i = 0; i < leafNodes.length; i++) {
    leafNodes[i]!.x = (i + 0.5) * rowHeight
  }
  eachAfter(root, node => {
    if (node.children?.length) {
      const first = node.children[0]!.x!
      const last = node.children[node.children.length - 1]!.x!
      node.x = (first + last) / 2
    }
  })

  root.data.length = 0
  setBrLength(root, 0, width / maxLength(root))
}

export interface HoveredInfo {
  sampleId: string
  sampleLabel: string
  pos: number
  base: string
  chr: string
  isInsertion?: boolean
  isLargeInsertion?: boolean
  [key: string]: unknown
}

export interface GenomicPosition {
  refName: string
  coord: number
}

export function generateTooltipContent(
  hoveredInfo: HoveredInfo | undefined,
  p1: GenomicPosition | undefined,
  p2: GenomicPosition,
): string {
  const contentLines: string[] = []

  if (p1) {
    contentLines.push(
      `Start: ${p1.refName}:${toLocale(p1.coord)}`,
      `End: ${p2.refName}:${toLocale(p2.coord)}`,
      `Length: ${getBpDisplayStr(Math.abs(p1.coord - p2.coord))}`,
    )
  } else {
    contentLines.push(`Ref: ${p2.refName}:${toLocale(p2.coord)}`)

    if (hoveredInfo) {
      const { base, sampleLabel, pos, chr, isInsertion } = hoveredInfo
      const thresh = 20
      const len = base.length
      const lengthSuffix = len > 1 ? ` ${len}bp` : ''
      const baseDisplay =
        base.length > thresh ? `${base.slice(0, thresh)  }...` : base
      const insertionLabel = isInsertion ? ' Insertion' : ''

      contentLines.push(
        `Alt ${sampleLabel}: ${chr}:${pos.toLocaleString('en-US')} (${baseDisplay}${lengthSuffix}${insertionLabel})`,
      )
    }
  }

  return contentLines.join('<br/>')
}

export interface MsaHighlight {
  refName: string
  start: number
  end: number
}

interface MsaViewLike {
  type?: string
  connectedViewId?: string
  connectedHighlights?: MsaHighlight[]
}

/**
 * Collect highlight regions from MSA views connected to `viewId`. Connections
 * are declared on the MSA view side via `connectedViewId`; cross-view access
 * is untyped, so we narrow defensively here in one place.
 */
export function getMsaHighlights(
  sessionViews: readonly unknown[],
  viewId: string,
): MsaHighlight[] {
  const result: MsaHighlight[] = []
  for (const v of sessionViews as MsaViewLike[]) {
    if (
      v.type === 'MsaView' &&
      v.connectedViewId === viewId &&
      v.connectedHighlights
    ) {
      for (const h of v.connectedHighlights) {
        result.push(h)
      }
    }
  }
  return result
}

export function computeNodeDescendantNames<T extends { name?: string }>(
  root: HierarchyNode<T>,
): Map<HierarchyNode<T>, string[]> {
  const map = new Map<HierarchyNode<T>, string[]>()
  function visit(node: HierarchyNode<T>): string[] {
    if (!node.children?.length) {
      const names = node.data.name === undefined ? [] : [node.data.name]
      map.set(node, names)
      return names
    }
    const names: string[] = []
    for (const child of node.children) {
      for (const name of visit(child)) {
        names.push(name)
      }
    }
    map.set(node, names)
    return names
  }
  visit(root)
  return map
}
