import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'

import type {
  TrackNodeSource,
  TreeCategoryNode,
  TreeTrackNode,
} from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}

// true if the two arrays share at least one element (symmetric)
export function intersects<T>(a: T[] = [], b: T[] = []) {
  const s = new Set(a)
  return b.some(x => s.has(x))
}

// true if `superset` contains every element of `subset`; argument order matters
export function containsAll<T>(superset: T[] = [], subset: T[] = []) {
  const s = new Set(superset)
  return subset.every(x => s.has(x))
}

// Everything the tree needs from a track's config, read once into
// model.allTracks instead of on every filterText keystroke. searchText is the
// text a query matches against: the name and each category, newline-joined so a
// query can't span two of them (the filter is a single-line field). sortName is
// the raw name slot rather than getTrackName, so the unnamed reference sequence
// track still sorts to the top.
export function trackNodeSourceFor(
  conf: AnyConfigurationModel,
  session: AbstractSessionModel,
): TrackNodeSource {
  const name = getTrackName(conf, session)
  const categories =
    (readConfObject(conf, 'category') as string[] | undefined) ?? []
  return {
    conf,
    name,
    sortName: String(readConfObject(conf, 'name') ?? ''),
    description:
      (readConfObject(conf, 'description') as string | undefined) ?? '',
    categories,
    searchText: [name, ...categories].join('\n').toLowerCase(),
  }
}

interface Node {
  children: Node[]
  id: string
}

// Collects IDs of subcategories that contain tracks, not just more folders.
// `obj` is the group level (depth 0, e.g. the "Tracks" group), so the user's
// top-level categories are depth 1 and true subcategories are depth > 1 — those
// are what "Collapse subcategories" targets, leaving top-level categories
// (which collapseTopLevelCategories handles) alone even when they hold tracks.
export function findSubCategories(obj: Node[]) {
  const paths: string[] = []
  function collect(nodes: Node[], depth: number) {
    for (const node of nodes) {
      if (node.children.length) {
        if (depth > 1 && node.children.some(c => !c.children.length)) {
          paths.push(node.id)
        }
        collect(node.children, depth + 1)
      }
    }
  }
  collect(obj, 0)
  return paths
}

export function findTopLevelCategories(obj: Node[]) {
  const paths: string[] = []
  for (const elt of obj) {
    if (elt.children.length) {
      paths.push(elt.id)
    }
  }
  return paths
}

export function getAllSubcategories(node: TreeCategoryNode): string[] {
  const categoryIds: string[] = []
  const stack = [node] as TreeCategoryNode[]
  while (stack.length > 0) {
    const curr = stack.pop()!
    for (const child of curr.children) {
      if (child.type === 'category') {
        categoryIds.push(child.id)
        stack.push(child)
      }
    }
  }
  return categoryIds
}

export function getAllTrackNodes(subtree: TreeCategoryNode): TreeTrackNode[] {
  const result: TreeTrackNode[] = []
  function collect(node: TreeCategoryNode) {
    for (const child of node.children) {
      if (child.type === 'track') {
        result.push(child)
      } else {
        collect(child)
      }
    }
  }
  collect(subtree)
  return result
}
