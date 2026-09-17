import { parseNewick } from '@gmod/newick'

import {
  newickLeafNames,
  rotateNewickByDomain,
} from './rotateNewickByDomain.ts'
import { writeNewick } from './writeNewick.ts'

/**
 * Compose a clustering run's result with the config `domain`: the dendrogram is
 * rotated towards the declared order and the run's `order` is re-read off it,
 * so the two land together and `treeDescribesRows` holds by construction.
 *
 * **A run's output, before it becomes state.** Rotating where the tree is
 * parsed instead would rotate a restored session's dendrogram without touching
 * the `layout` saved beside it — a session clustered under one domain and
 * reopened under another would draw no tree at all.
 *
 * Returns the run untouched when there is nothing to compose: no domain, no
 * tree, or a tree whose leaves are not exactly these rows, which is the run the
 * display would have landed anyway.
 */
export function rotateClusterRun<S extends { name: string }>({
  rows,
  order,
  tree,
  domain,
}: {
  rows: readonly S[]
  order: number[]
  tree?: string
  domain: readonly string[]
}): { order: number[]; tree?: string } {
  if (!domain.length || !tree) {
    return { order, tree }
  }
  const rotated = rotateNewickByDomain(parseNewick(tree), domain)
  const indexByName = new Map(rows.map((r, i) => [r.name, i]))
  const names = newickLeafNames(rotated)
  const next = names.flatMap(name => {
    const idx = indexByName.get(name)
    return idx === undefined ? [] : [idx]
  })
  return next.length === order.length && new Set(next).size === next.length
    ? { order: next, tree: writeNewick(rotated) }
    : { order, tree }
}
