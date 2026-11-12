import { quoteName } from '@gmod/hclust'
import { parseNewick } from '@gmod/newick'

import {
  eachAfter,
  hasIncrementalBranchLengths,
  hierarchy,
} from './hierarchy.ts'

import type { HierarchyNode } from './hierarchy.ts'
import type { NewickNode } from '@gmod/newick'

/**
 * Rotate a tree towards a declared leaf order, the way ggtree's `rotate` /
 * `flip` turn a clade without changing what it says: at every internal node the
 * children are ordered by the earliest `domain` index among their leaves, and
 * children holding no listed leaf keep the order they were written in.
 *
 * A phylogeny fixes its leaf order only up to a rotation at each node, so the
 * result is the same tree drawn differently — never a reordering of the rows
 * against it. The domain is therefore a preference rather than a placement:
 * `['B','C','D']` on `((A,B),(C,D))` gives `B,A,C,D`, because A rides with B.
 *
 * Nothing is sorted in place. The parsed tree is cached per Newick string, so
 * an in-place sort would compound across domain changes and leave an unlisted
 * clade unable to return to file order. Every node on the path to a moved child
 * is rebuilt; the rest are shallow copies.
 *
 * Iterative, like every traversal beside it: a dendrogram can be a caterpillar
 * whose depth is its leaf count, and recursion throws past about 5000 tips.
 */
export function rotateNewickByDomain(
  node: NewickNode,
  domain: readonly string[],
): NewickNode {
  const rank = new Map<string, number>()
  for (const [i, name] of domain.entries()) {
    if (!rank.has(name)) {
      rank.set(name, i)
    }
  }
  const unlisted = domain.length
  const preorder = newickPreorder(node)
  const rotated = new Map<NewickNode, NewickNode>()
  const earliest = new Map<NewickNode, number>()
  for (let i = preorder.length - 1; i >= 0; i--) {
    const n = preorder[i]!
    if (n.children?.length) {
      const children = [...n.children].sort(
        (a, b) => earliest.get(a)! - earliest.get(b)!,
      )
      earliest.set(n, earliest.get(children[0]!)!)
      rotated.set(n, { ...n, children: children.map(c => rotated.get(c)!) })
    } else {
      earliest.set(
        n,
        (n.name === undefined ? undefined : rank.get(n.name)) ?? unlisted,
      )
      rotated.set(n, { ...n })
    }
  }
  return rotated.get(node)!
}

/**
 * Every node under `node`, each before its descendants, so a walk backwards
 * meets every child before its parent and can build bottom-up. Iterative for
 * the reason {@link rotateNewickByDomain} is.
 */
export function newickPreorder<N extends { children?: N[] }>(node: N) {
  const preorder: N[] = []
  const stack = [node]
  while (stack.length > 0) {
    const n = stack.pop()!
    preorder.push(n)
    if (n.children) {
      for (const child of n.children) {
        stack.push(child)
      }
    }
  }
  return preorder
}

/**
 * Leaf names left to right, which is row order — so the traversal order is the
 * contract. Iterative for the reason {@link rotateNewickByDomain} is.
 */
export function newickLeafNames(node: NewickNode): string[] {
  const names: string[] = []
  const stack = [node]
  while (stack.length > 0) {
    const n = stack.pop()!
    if (n.children?.length) {
      for (let i = n.children.length - 1; i >= 0; i--) {
        stack.push(n.children[i]!)
      }
    } else if (n.name !== undefined) {
      names.push(n.name)
    }
  }
  return names
}

/**
 * Serialize a parsed tree back to Newick — the inverse of `parseNewick`, for
 * the one thing that rewrites a tree rather than reading it: rotating a
 * clustering run's dendrogram towards the config `domain` before it is stored.
 *
 * **Escaping is `quoteName`'s**, imported rather than restated. A leaf name is
 * an arbitrary string out of somebody's data file, and one holding a `(` or a
 * `,` written bare IS grammar — it parses back as a different tree, silently.
 * Two implementations of that rule are two chances to disagree with the parser.
 *
 * Both `length` encodings survive, because reading either as the other inverts
 * the tree. A leaf carrying a length is the tell for the incremental form
 * (`(A:0.1,B:0.2)`, what hclust writes from v5 and what a `.nh` carries), and
 * the absolute merge height hclust v4 wrote into the label slot (`(A,B)1.5`)
 * goes back there — writing it as `:1.5` would add the first `:` in the string
 * and flip the whole tree onto the cumulative layout.
 *
 * Iterative and dropping each subtree's string as it folds into its parent, for
 * the reasons `toNewick` states: a caterpillar is deep enough to overflow the
 * stack, and holding every intermediate string is quadratic.
 */
export function writeNewick(node: NewickNode): string {
  const preorder = newickPreorder(node)
  const incremental = preorder.some(
    n => !n.children?.length && n.length !== undefined,
  )
  const rendered = new Map<NewickNode, string>()
  for (let i = preorder.length - 1; i >= 0; i--) {
    const n = preorder[i]!
    const name = n.name === undefined ? '' : quoteName(n.name) || "''"
    const length =
      n.length === undefined ? '' : incremental ? `:${n.length}` : `${n.length}`
    if (n.children?.length) {
      const parts = n.children.map(c => {
        const s = rendered.get(c)!
        rendered.delete(c)
        return s
      })
      rendered.set(n, `(${parts.join(',')})${name}${length}`)
    } else {
      rendered.set(n, `${name}${length}`)
    }
  }
  return `${rendered.get(node)!};`
}

/**
 * `newick` with each leaf renamed by `rename`, its shape and its lengths, in
 * either encoding, kept. A leaf written bare has no name, and `rename` is
 * handed undefined for it.
 */
export function renameNewickLeaves(
  newick: string,
  rename: (name: string | undefined) => string | undefined,
) {
  const root = parseNewick(newick)
  for (const n of newickPreorder(root)) {
    if (!n.children?.length) {
      n.name = rename(n.name)
    }
  }
  return writeNewick(root)
}

function findSubtree<T extends NewickNode>(
  root: HierarchyNode<T>,
  filterSet: Set<string>,
): HierarchyNode<T> | undefined {
  // Single post-order pass: at each node track (leaf-name count below,
  // whether all those names are in filterSet). The first node whose count
  // equals filterSet.size and is fully contained is the unique match
  // (descendants have strictly fewer leaves).
  //
  // `eachAfter` rather than a recursive walk for the reason every traversal in
  // this package is iterative: a single-linkage dendrogram is a caterpillar
  // whose depth is its leaf count. It visits a node only after all of its
  // descendants, so the first match is still the deepest one — which is what
  // picks the clade itself over an ancestor that adds only unnamed leaves.
  const below = new Map<HierarchyNode<T>, { count: number; allIn: boolean }>()
  let found: HierarchyNode<T> | undefined
  eachAfter(root, (n: HierarchyNode<T>) => {
    if (n.children?.length) {
      let count = 0
      let allIn = true
      for (const child of n.children) {
        const r = below.get(child)!
        count += r.count
        if (!r.allIn) {
          allIn = false
        }
      }
      below.set(n, { count, allIn })
      if (!found && allIn && count === filterSet.size) {
        found = n
      }
    } else {
      const { name } = n.data
      below.set(
        n,
        name === undefined
          ? { count: 0, allIn: true }
          : { count: 1, allIn: filterSet.has(name) },
      )
    }
  })
  return found
}

// Parse a Newick string and build a hierarchy, without applying a filter.
// Kept separate from treeOfLeaves so MST can cache them independently —
// changing the focus re-runs only the traversal, not the parser.
//
// `domain` rotates the tree towards a declared leaf order
// (`rotateNewickByDomain`); empty leaves it as written.
//
// `forksOf` names the rows a leaf stands for where none of them is the leaf
// itself, as a sample leaf stands for its haplotype rows: the leaf becomes a
// zero-length fork over them (`forkLeaves`), after the rotation, since the
// domain names the leaf rather than the rows it forks into.
export function buildTree(
  newick: string,
  domain: readonly string[] = [],
  forksOf?: (leaf: string) => readonly string[] | undefined,
): HierarchyNode<NewickNode> {
  const rotated = rotateNewickByDomain(parseNewick(newick), domain)
  return hierarchy<NewickNode>(
    forksOf ? forkLeaves(rotated, forksOf) : rotated,
    d => d.children,
  )
}

function forkOf(
  leaf: NewickNode,
  rows: readonly string[],
  incremental: boolean,
): NewickNode {
  return incremental
    ? {
        length: leaf.length ?? 0,
        children: rows.map(name => ({ name, length: 0 })),
      }
    : { length: 0, children: rows.map(name => ({ name })) }
}

/**
 * `root` with each leaf `forksOf` names rows for replaced by a fork over those
 * rows, in the order given, at zero length: the rows join where the leaf did,
 * and split at no height. Iterative, as every traversal here, since a
 * single-linkage tree is as deep as it has leaves. Replaces nodes in place, so
 * it takes a tree no one else holds, as a fresh parse is.
 */
function forkLeaves(
  root: NewickNode,
  forksOf: (leaf: string) => readonly string[] | undefined,
): NewickNode {
  const leafNodes: NewickNode[] = []
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()!
    if (node.children?.length) {
      stack.push(...node.children)
    } else {
      leafNodes.push(node)
    }
  }
  const incremental = leafNodes.some(leaf => leaf.length !== undefined)
  const forked = (node: NewickNode) => {
    const rows =
      node.children?.length || node.name === undefined
        ? undefined
        : forksOf(node.name)
    return rows?.length ? forkOf(node, rows, incremental) : node
  }
  const walk = [root]
  while (walk.length) {
    const node = walk.pop()!
    if (node.children) {
      node.children = node.children.map(forked)
      walk.push(...node.children)
    }
  }
  return forked(root)
}

// Prune a Newick-shaped tree down to just the leaves in `keep`, preserving the
// topology among them. Internal nodes left with a single child are collapsed
// into that child so the result has no spurious unary nodes. Returns undefined
// if no kept leaf is below `node`.
//
// Unlike `findSubtree` (which only matches a single monophyletic clade), this
// works for any leaf set — e.g. a scattered hand-picked species selection — so
// the rendered dendrogram always matches the visible rows rather than falling
// back to the full tree.
//
// `incrementalLengths` says which of the two `length` encodings the tree uses
// (see `hasIncrementalBranchLengths`). Only incremental lengths add up when a
// node collapses. In the absolute form — a merge height, from hclust v4 and the
// saved sessions that still carry it — summing invents a depth the child never
// had, and because that form leaves leaves bare, handing one a `length` flips
// the whole tree onto the cumulative phylogram layout.
export function pruneNewickToLeaves(
  node: NewickNode,
  keep: Set<string>,
  incrementalLengths = true,
): NewickNode | undefined {
  // Built bottom-up on the raw newick data rather than a HierarchyNode: each
  // node's replacement only once every child's is known.
  const order = newickPreorder(node)
  const pruned = new Map<NewickNode, NewickNode | undefined>()
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i]!
    if (n.children?.length) {
      const children = n.children.flatMap(c => {
        const p = pruned.get(c)
        return p ? [p] : []
      })
      pruned.set(
        n,
        children.length === 0
          ? undefined
          : children.length === 1
            ? incrementalLengths
              ? {
                  ...children[0]!,
                  length: (children[0]!.length ?? 0) + (n.length ?? 0),
                }
              : children[0]!
            : { ...n, children },
      )
    } else {
      pruned.set(n, n.name !== undefined && keep.has(n.name) ? n : undefined)
    }
  }
  return pruned.get(node)
}

// Narrow a tree to the leaves named. A list that names exactly one
// clade's leaves descends into that clade (the monophyletic case, e.g. clicking
// an internal node); any other leaf set is pruned to those leaves with the
// topology preserved. Returns the original root when none are named or no
// kept leaf remains.
export function treeOfLeaves(
  root: HierarchyNode<NewickNode>,
  names: readonly string[] | undefined,
): HierarchyNode<NewickNode> {
  if (!names?.length) {
    return root
  }
  const filterSet = new Set(names)
  const monophyletic = findSubtree(root, filterSet)
  if (monophyletic) {
    return monophyletic
  }
  const pruned = pruneNewickToLeaves(
    root.data,
    filterSet,
    hasIncrementalBranchLengths(root),
  )
  return pruned ? hierarchy<NewickNode>(pruned, d => d.children) : root
}
