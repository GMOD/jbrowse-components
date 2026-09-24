import { quoteName } from '@gmod/hclust'

import type { NewickNode } from '@gmod/newick'

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
