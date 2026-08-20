// Delete entries from the `new Set([...])` literals in recipe-path-labels.ts,
// and the comment above them once nothing that comment covers is left — a
// reason standing over the next entry down reads as that entry's reason.
//
// Line-wise rather than through the TypeScript printer, which reprints the
// whole file and drops its comments to remove one line. That makes it a text
// transform, which is the reason it is here and pure: a rewriter aimed at a
// source file is worth testing against strings rather than against the one file
// it happens to edit today.

/**
 * `source` with every entry in `dead` removed from its set literals.
 *
 * A GROUP IS A COMMENT BLOCK PLUS THE ENTRIES UNDER IT, and it is emitted whole
 * or not at all. What decides "not at all" is that the group HAD entries and
 * every one of them was dead — never merely that it has none right now, which is
 * what a blank line between a comment and its entries produces. Getting that
 * backwards deletes a live comment silently, and this function's whole job is
 * editing a file nobody is watching at the time.
 */
export function dropExemptionLines(source: string, dead: Iterable<string>) {
  const drop = new Set(dead)
  const out: string[] = []
  let comments: string[] = []
  let kept: string[] = []
  let sawEntry = false
  let inSet = false
  const flush = () => {
    // `!sawEntry` keeps a comment block nothing has been filed under yet; the
    // drop is only for a block whose every entry died.
    if (kept.length > 0 || !sawEntry) {
      out.push(...comments, ...kept)
    }
    comments = []
    kept = []
    sawEntry = false
  }
  for (const line of source.split('\n')) {
    const text = line.trim()
    if (!inSet) {
      out.push(line)
      inSet = text.includes('new Set([')
      continue
    }
    if (text.startsWith('//')) {
      // a comment below entries opens the next group rather than joining theirs
      if (sawEntry) {
        flush()
      }
      comments.push(line)
      continue
    }
    const literal = /^(['"])((?:\\.|[^\\])*?)\1,?$/.exec(text)
    if (literal) {
      sawEntry = true
      if (!drop.has(literal[2]!.replaceAll(/\\(.)/g, '$1'))) {
        kept.push(line)
      }
      continue
    }
    flush()
    out.push(line)
    inSet = !text.startsWith('])')
  }
  flush()
  return out.join('\n')
}
