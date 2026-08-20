import { readConfObject } from '@jbrowse/core/configuration'
import { getTrackName } from '@jbrowse/core/util/tracks'

import { buildSearchText } from '../shared/searchText.ts'

import type {
  TrackNodeSource,
  TreeCategoryNode,
  TreeTrackNode,
} from './types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// The tree id of a category: its group (the config's own tracks, or a
// connection) plus the comma-joined category path. Built in one place so the
// hierarchy and the config slots that name a category by path agree.
export function categoryId(groupId: string, categoryPath: string) {
  return `${groupId}-${categoryPath}`
}

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}

// true if `superset` contains every element of `subset`; argument order matters
export function containsAll<T>(superset: T[] = [], subset: T[] = []) {
  const s = new Set(superset)
  return subset.every(x => s.has(x))
}

// The category a non-admin's added/copied tracks nest under. Leading space so
// it sorts above the config's own categories.
const sessionTracksCategory = ' Session tracks'

// Everything the tree needs from a track's config, read once into
// model.allTracks instead of on every filterText keystroke. searchText covers
// what a tree row shows — its name, the categories it nests under, and the
// description it carries as a tooltip — and is normalized by buildSearchText,
// which the faceted selector's rows go through too. Adapter and metadata are
// left out here because, unlike in the faceted grid, the tree renders neither.
// sortName is the raw name slot rather than getTrackName, so the unnamed
// reference sequence track still sorts to the top.
//
// A session track's pseudo-category is prepended here rather than where the
// hierarchy is built, so it is one of the categories for every purpose that
// reads them — sorting, the subcategory count, and searching. The tree draws
// that folder, and the rule is that the filter box searches what the tree
// shows.
export function trackNodeSourceFor(
  conf: AnyConfigurationModel,
  {
    session,
    isSessionTrack = false,
  }: {
    session: AbstractSessionModel
    isSessionTrack?: boolean
  },
): TrackNodeSource {
  const name = getTrackName(conf, session)
  const ownCategories =
    (readConfObject(conf, 'category') as string[] | undefined) ?? []
  const categories = isSessionTrack
    ? [sessionTracksCategory, ...ownCategories]
    : ownCategories
  const description =
    (readConfObject(conf, 'description') as string | undefined) ?? ''
  return {
    conf,
    name,
    sortName: String(readConfObject(conf, 'name') ?? ''),
    description,
    categories,
    searchText: buildSearchText([name, description, ...categories]),
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
