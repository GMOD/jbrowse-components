import { getContainingView } from '@jbrowse/core/util/mstUtils'
import { hasParent, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The color a display draws one haplotype in, named as PanSN names it:
 * `sample`, and `haplotype` counting from 1 where a VCF's phase index counts
 * from 0. A graph display publishes one per haplotype walk it draws in a
 * color of its own, as `haplotypeColors`.
 */
export interface HaplotypeColor {
  sample: string
  haplotype?: number
  color: string
}

/** A row asking for its haplotype's color: its sample, and its phase index where it is one haplotype. */
export interface HaplotypeRow {
  name: string
  sample: string
  phase?: number
}

function publishedColors(display: unknown): readonly HaplotypeColor[] {
  return typeof display === 'object' &&
    display !== null &&
    'haplotypeColors' in display &&
    Array.isArray(display.haplotypeColors)
    ? display.haplotypeColors
    : []
}

function containingView(node: IAnyStateTreeNode): object | undefined {
  if (!isStateTreeNode(node) || !hasParent(node)) {
    return undefined
  }
  try {
    return getContainingView(node)
  } catch {
    return undefined
  }
}

function displaysOf(track: unknown): unknown[] {
  return typeof track === 'object' &&
    track !== null &&
    'displays' in track &&
    Array.isArray(track.displays)
    ? track.displays
    : []
}

/**
 * The haplotype colors every other display in `node`'s view publishes,
 * none for a display standing in no view, as a static export's host.
 */
export function viewHaplotypeColors(node: IAnyStateTreeNode) {
  const view = containingView(node)
  const tracks =
    view && 'tracks' in view && Array.isArray(view.tracks) ? view.tracks : []
  return tracks
    .flatMap(displaysOf)
    .filter(display => display !== node)
    .flatMap(publishedColors)
}

/**
 * Each row's haplotype color, by row name: a haplotype row takes its own
 * haplotype's, and a sample row takes its sample's where every haplotype of
 * the sample drawn shares one color.
 */
export function haplotypeRowColors(
  rows: readonly HaplotypeRow[],
  published: readonly HaplotypeColor[],
) {
  const colors = new Map<string, string>()
  if (published.length > 0) {
    for (const row of rows) {
      const { phase } = row
      const ofSample = published.filter(p => p.sample === row.sample)
      const own =
        phase === undefined
          ? new Set(ofSample.map(p => p.color)).size === 1
            ? ofSample[0]
            : undefined
          : ofSample.find(p => p.haplotype === phase + 1)
      if (own) {
        colors.set(row.name, own.color)
      }
    }
  }
  return colors
}
