// A rename sweeps every USE of a name. The one place it must not touch is the
// sentence recording the rename — and that sentence is written in the old name,
// so a find-and-replace rewrites it into a tautology.
//
// The result says the opposite of what it means:
//
//   // It was `gateActive`, and none of its three terms was ever about bytes
//   get gateActive() { … }
//
// which reads as "the current name was the bad one". Both halves are wrong: the
// old name was `byteGateActive`, and the sentence's own argument ("none of its
// terms was about bytes") only applies to the name that carries `byte`.
//
// Nothing else can see this. tsc is happy — the identifier resolves. The doc
// checkers are happy — the symbol exists. A reviewer reading the diff sees a
// mechanical rename touch a comment, which is what a correct rename also does.
// It went unnoticed three times in one file, and a hand audit of that same file
// caught only the first.
//
// The signature is narrow on purpose: a past-tense rename idiom naming an
// identifier **the same file currently declares**. After a rename the old name
// is gone from the file, so a live local name in that slot is the tautology.

const RENAME =
  /\b(?:it |this |which )?(?:was|used to be)\s+(?:called|named|spelled)?\s*`([A-Za-z_$][\w$]*)`/gi

// The same tautology with the name in front of the idiom — "Not `gateExempt`,
// which is what it was called while saying …". `RegionTooLargeMixin.ts` carried
// one of these for as long as it took someone to read the getter's own name back
// to it, because the pattern above only ever looked after the verb.
//
// Narrower than that one on purpose, since a name before a bare "was" is
// ordinary prose ("`foo` was removed", "`foo` was measured"): the verb has to be
// an explicit naming one, and the name has to sit within a short span of it, so
// a sentence that merely mentions an identifier earlier in the line doesn't
// qualify.
const RENAME_NAME_FIRST =
  /`([A-Za-z_$][\w$]*)`[^`]{0,60}?\b(?:was|used to be)\s+(?:called|named|spelled)\b/gi

const COMMENT = /^\s*(\/\/|\*|\/\*)/
const stripMarker = (l = '') => l.replace(/^\s*(\/\/|\*|\/\*\*?)\s?/, '')

/**
 * Does this file declare `name` as its own top-level or member binding? A
 * declaration, not a mention — a rename leaves plenty of legitimate mentions.
 */
export function declaresLocally(text: string, name: string) {
  const n = name.replaceAll('$', String.raw`\$`)
  return new RegExp(
    // function/const/class/type …
    String.raw`(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|type|enum)\s+${n}\b` +
      // get x() / set x()
      String.raw`|(?:^|\n)\s*(?:get|set)\s+${n}\s*\(` +
      // an indented method or MST action: `  x(` at depth
      String.raw`|(?:^|\n)\s{2,}${n}\s*\(`,
  ).test(text)
}

export interface RenameArchaeologyHit {
  line: number
  name: string
  text: string
}

/**
 * Comment lines whose rename idiom names a locally-declared identifier.
 *
 * Joins two lines, because these comments wrap and the name lands on the second
 * about as often as the first. Reports one hit per (file, name) so a wrapped
 * sentence is not three findings.
 */
export function findRenameArchaeology(text: string): RenameArchaeologyHit[] {
  if (!/\bwas\b|used to be/i.test(text)) {
    return []
  }
  const lines = text.split('\n')
  const seen = new Set<string>()
  const hits: RenameArchaeologyHit[] = []
  lines.forEach((line, i) => {
    if (!COMMENT.test(line)) {
      return
    }
    // Join the next line only when it is also a comment. A rename sentence
    // wraps onto another comment line; it never wraps into code, and joining
    // code pulls a declaration into the window that the sentence never named.
    const next = lines[i + 1]
    const window =
      next !== undefined && COMMENT.test(next)
        ? `${stripMarker(line)} ${stripMarker(next)}`
        : stripMarker(line)
    RENAME.lastIndex = 0
    RENAME_NAME_FIRST.lastIndex = 0
    for (const m of [
      ...window.matchAll(RENAME),
      ...window.matchAll(RENAME_NAME_FIRST),
    ]) {
      const name = m[1]!
      if (seen.has(name) || !declaresLocally(text, name)) {
        continue
      }
      seen.add(name)
      hits.push({ line: i + 1, name, text: stripMarker(line).trim() })
    }
  })
  return hits
}
