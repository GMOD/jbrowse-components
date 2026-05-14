import { getBpDisplayStr, toLocale } from '@jbrowse/core/util'

import type { HierarchyNode } from '@jbrowse/tree-sidebar'

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
        base.length > thresh ? base.slice(0, thresh) + '...' : base
      const insertionLabel = isInsertion ? ' Insertion' : ''

      contentLines.push(
        `Alt ${sampleLabel}: ${chr}:${pos.toLocaleString('en-US')} (${baseDisplay}${lengthSuffix}${insertionLabel})`,
      )
    }
  }

  return contentLines.join('<br/>')
}

export function computeNodeDescendantNames<T extends { name: string }>(
  root: HierarchyNode<T>,
): Map<HierarchyNode<T>, string[]> {
  const map = new Map<HierarchyNode<T>, string[]>()
  function visit(node: HierarchyNode<T>): string[] {
    if (!node.children || node.children.length === 0) {
      const names = [node.data.name]
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
