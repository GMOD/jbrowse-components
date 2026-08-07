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
 *   ('A (x)','B,y')1.5    — single-quoted labels, `''` for a literal quote
 *
 * The quoted form is not decoration: a row name is an arbitrary string from
 * somebody's data file, and one holding a `(` or a `,` is grammar rather than a
 * label unless it is quoted. `@gmod/hclust`'s `quoteName` is the writing half of
 * that rule and this is the reading half, so the two have to agree exactly; the
 * escaping itself is not reimplemented here.
 */
export interface NewickNode {
  name?: string
  length?: number
  children?: NewickNode[]
}

const NUMERIC_TOKEN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/

interface Token {
  text: string
  // a bare grammar character, as opposed to label text that happens to equal one
  delim: boolean
  // arrived single-quoted, so it is a label whatever it looks like
  quoted: boolean
}

// Split into grammar characters and labels. A hand-rolled scanner rather than
// the `split(/\s*(;|\(|\)|,|:)\s*/)` this used to be, because a regex split
// cannot know it is inside a quoted label and so splits the label apart on the
// very characters quoting exists to protect.
//
// Whitespace is consumed around the delimiters and not inside labels: variants'
// phased rows are named `NA18536 HP0`, and stripping globally welded them shut
// so no label matched a row. Inside quotes it is kept verbatim.
function tokenize(s: string): Token[] {
  const out: Token[] = []
  // text since the last delimiter, kept apart so a quoted label can own the
  // token: whitespace written around the quotes is layout in a hand-formatted
  // .nh file, not part of the name
  let bare = ''
  let quotedText = ''
  let quoted = false
  function flush() {
    const text = quoted ? quotedText : bare.trim()
    // an empty run between two delimiters is not a label; an explicitly quoted
    // '' is one, so it survives
    if (text !== '' || quoted) {
      out.push({ text, delim: false, quoted })
    }
    bare = ''
    quotedText = ''
    quoted = false
  }
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!
    if (c === "'") {
      quoted = true
      for (i++; i < s.length; i++) {
        if (s[i] !== "'") {
          quotedText += s[i]!
        } else if (s[i + 1] === "'") {
          // '' is an escaped literal quote, not the end of the label
          quotedText += "'"
          i++
        } else {
          break
        }
      }
    } else if (c === '(' || c === ')' || c === ',' || c === ':' || c === ';') {
      flush()
      out.push({ text: c, delim: true, quoted: false })
    } else {
      bare += c
    }
  }
  flush()
  return out
}

export default function parseNewick(s: string): NewickNode {
  const ancestors: NewickNode[] = []
  const tokens = tokenize(s)

  // `@gmod/hclust`'s `toNewick` never emits a `:`, so a colon anywhere means
  // standard phylo Newick — where a numeric post-paren token is a bootstrap
  // support value, not a merge height. Reading `(A:0.1,B:0.2)95` as length 95
  // makes the phylogram sum support values into the branch distances, dwarfing
  // the real lengths.
  //
  // Asked of the delimiters rather than of the raw string: a leaf legitimately
  // named for a region (`chr1:1-100`) carries a colon of its own, and testing
  // the string flipped a whole hclust tree into the phylo reading over it.
  const hclustForm = !tokens.some(t => t.delim && t.text === ':')

  let tree: NewickNode = {}
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const subtree: NewickNode = {}
    if (token.delim) {
      switch (token.text) {
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
        default:
          // ':' and ';' are consumed by the label that follows them
          break
      }
      continue
    }
    const prev = i > 0 ? tokens[i - 1] : undefined
    const prevDelim = prev?.delim ? prev.text : undefined
    if (prevDelim === ':') {
      tree.length = Number.parseFloat(token.text)
    } else if (prevDelim === ')') {
      // hclust serializes `(A,B)1.5` with the numeric height as the label;
      // standard phylo Newick puts a name (or a bootstrap value) there.
      // Disambiguate with a regex so tokens like `1.50` or `1e-3` (which fail a
      // String(n) round-trip) still parse as length. A QUOTED token is never a
      // length: quoting is the writer saying this is a label, which is the only
      // way to name a node `1.5`.
      if (hclustForm && !token.quoted && NUMERIC_TOKEN.test(token.text)) {
        tree.length = Number.parseFloat(token.text)
      } else {
        tree.name = token.text
      }
    } else if (
      prevDelim === '(' ||
      prevDelim === ',' ||
      // nothing before it at all: the whole tree is one bare node (`A;`), which
      // is what a one-row track serializes to. Without this the name was
      // dropped, and a root leaf with no name matches no row, so
      // `treeDescribesRows` declined the tree rather than drawing it.
      prevDelim === undefined
    ) {
      tree.name = token.text
    }
  }
  return tree
}
