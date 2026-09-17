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
  const preorder: NewickNode[] = []
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
