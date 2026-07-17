/**
 * Newick format parser in JavaScript.
 *
 * Originally based on Jason Davies' 2010 implementation. Extended to handle the
 * `(A,B)1.5` post-paren-numeric form used by `@gmod/hclust` to serialize
 * clustering results (encodes internal node height as the label rather than as
 * a `:` branch length). Output normalizes to a single `length` field
 * regardless of which input form provided it.
 *
 * Supported forms:
 *
 *   (A:0.1,B:0.2)F        — name and `:` branch length (standard phylo Newick)
 *   (A:0.1,B:0.2)F:0.5    — internal node name + branch length to parent
 *   (A,B)1.5              — numeric post-paren stored as `length` (hclust form)
 *   (A,B)Foo              — non-numeric post-paren stored as `name`
 */
export interface NewickNode {
  name?: string
  length?: number
  children?: NewickNode[]
}

const NUMERIC_TOKEN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/

export default function parseNewick(s: string): NewickNode {
  const ancestors: NewickNode[] = []

  let tree: NewickNode = {}
  // Consume whitespace around the delimiters rather than everywhere: leaf
  // labels carry meaningful spaces (variants' phased `"NA18536 HP0"`), and
  // stripping globally silently welded them shut, so no label matched a row.
  const tokens = s.split(/\s*(;|\(|\)|,|:)\s*/)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const subtree: NewickNode = {}
    switch (token) {
      case '(':
        tree.children = [subtree]
        ancestors.push(tree)
        tree = subtree
        break
      case ',':
        ancestors.at(-1)?.children?.push(subtree)
        tree = subtree
        break
      case ')':
        tree = ancestors.pop()!
        break
      case ':':
      case ';':
        break
      default: {
        if (token === '') {
          break
        }
        const prev = i > 0 ? tokens[i - 1] : undefined
        if (prev === ':') {
          tree.length = Number.parseFloat(token)
        } else if (prev === ')') {
          // hclust serializes `(A,B)1.5` with the numeric height as the label;
          // standard phylo Newick puts a name there. Disambiguate with a
          // regex so tokens like `1.50` or `1e-3` (which fail a String(n)
          // round-trip) still parse as length.
          if (NUMERIC_TOKEN.test(token)) {
            tree.length = Number.parseFloat(token)
          } else {
            tree.name = token
          }
        } else if (prev === '(' || prev === ',') {
          tree.name = token
        }
      }
    }
  }
  return tree
}
