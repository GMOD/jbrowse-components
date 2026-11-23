import { coarseStripHTML } from '@jbrowse/core/util'
import { termPattern } from '@jbrowse/core/util/searchText'
import { trackCatalogEntry } from '@jbrowse/core/util/tracks'

import { getRootKeys } from '../TrackTable/tableUtil.ts'
import { buildTrackSearchText } from '../shared/searchText.ts'

import type {
  TrackNodeSource,
  TreeCategoryNode,
  TreeTrackNode,
} from './types.ts'
import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { TrackCatalog } from '@jbrowse/core/util'

// The tree id of a category: its group (the config's own tracks, or a
// connection) plus the comma-joined category path. Built in one place so the
// hierarchy and the config slots that name a category by path agree.
export function categoryId(groupId: string, categoryPath: string) {
  return `${groupId}-${categoryPath}`
}

export function isUnsupported(name = '') {
  return name.endsWith('(Unsupported)') || name.endsWith('(Unknown)')
}

// The category a non-admin's added/copied tracks nest under. Leading space so
// it sorts above the config's own categories.
const sessionTracksCategory = ' Session tracks'

// Everything the tree needs from a track's config, read once into
// model.allTracks instead of on every filterText keystroke. searchText covers
// a row's name, the categories it nests under, its description and its
// metadata values, normalized by buildTrackSearchText as the track table's
// rows are. The description and metadata are not on the row, so hintFields
// keeps them for matchHint to say which one a query hit.
// Each is a raw member read, so a frozen entry answers without hydrating, and
// supplies the slot's default itself since a frozen entry omits it. sortName is the raw name slot rather than getTrackName, so the unnamed
// reference sequence track still sorts to the top.
//
// A session track's pseudo-category is prepended here rather than where the
// hierarchy is built, so it is one of the categories for every purpose that
// reads them — sorting, the subcategory count, and searching.
export function trackNodeSourceFor(
  conf: AnyTrackConfig,
  {
    session,
    isSessionTrack = false,
  }: {
    session: TrackCatalog
    isSessionTrack?: boolean
  },
): TrackNodeSource {
  const { name, category, description } = trackCatalogEntry(conf, session)
  const categories = isSessionTrack
    ? [sessionTracksCategory, ...category]
    : category
  const metadata = (conf.metadata ?? {}) as Record<string, unknown>
  const hintFields = [
    ...getRootKeys(metadata).map(key => hintField(key, String(metadata[key]))),
    ...(description ? [hintField('description', description)] : []),
  ]
  return {
    conf,
    name,
    sortName: String(conf.name ?? ''),
    description,
    categories,
    hintFields,
    searchText: buildTrackSearchText([
      name,
      ...categories,
      ...hintFields.map(([, value]) => value),
    ]),
  }
}

/**
 * A field a row can name in its hint, as the plain text a table cell shows:
 * descriptions and metadata values may be markup
 */
export function hintField(key: string, value: string): [string, string] {
  return [key, coarseStripHTML(value)]
}

const snippetLead = 12

/**
 * A value whose term sits past its first few characters, from the word holding
 * the term on (or from the term, deep in a long word such as a URL), after an
 * ellipsis, so a row cut at its end still shows the term
 */
export function snippetAround(value: string, term: string) {
  const index = value.search(termPattern(term))
  const wordStart = value.lastIndexOf(' ', index - 1) + 1
  const start = index - wordStart > snippetLead ? index : wordStart
  return index > snippetLead && start > 0 ? `…${value.slice(start)}` : value
}

/**
 * What a row shows beside its name while a query is set: for each term its
 * name and drawn categories lack, the first metadata field holding it as
 * `key: value`, else the description's text alone, so a track kept for text
 * off the row says why. The description goes unlabeled since the row's
 * tooltip already shows it and the label would take the room a long name
 * leaves. A long value starts near the term. Metadata goes first since its
 * values are usually short.
 */
export function matchHint(
  {
    name,
    categories,
    hintFields,
  }: Pick<TrackNodeSource, 'name' | 'categories' | 'hintFields'>,
  terms: string[],
) {
  const shown = buildTrackSearchText([name, ...categories])
  const hits = new Map<string, string>()
  for (const term of terms) {
    if (!shown.includes(term)) {
      const field = hintFields.find(([, value]) =>
        buildTrackSearchText([value]).includes(term),
      )
      if (field && !hits.has(field[0])) {
        hits.set(field[0], snippetAround(field[1], term))
      }
    }
  }
  return [...hits]
    .map(([key, value]) => (key === 'description' ? value : `${key}: ${value}`))
    .join(' · ')
}

interface Node {
  children: Node[]
  id: string
}

// Collects IDs of subcategories that contain tracks, not just more folders.
// `obj` is the group level (depth 0, e.g. the "Tracks" group), so the user's
// top-level categories are depth 1 and true subcategories are depth > 1 — those
// are what `defaultCollapsed.subCategories` targets, leaving top-level
// categories (`defaultCollapsed.topLevelCategories`) alone even when they hold
// tracks.
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
