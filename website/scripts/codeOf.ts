/**
 * A source file with its COMMENTS removed, which is what the symbol set has to
 * be built from.
 *
 * Collecting over whole files made the check self-defeating in one direction
 * and blind in the other. A source comment naming a symbol that no longer
 * exists put that name in the set, so it was exempt in every doc, repo-wide and
 * invisibly — the very drift this check exists for, whitelisted by the prose
 * that drifted alongside it. And it is why the same test could never be pointed
 * at source comments themselves: every one of them was its own evidence.
 *
 * It was not hypothetical. Stripping comments surfaced, immediately, a CLAUDE.md
 * section maintaining a CRAM walk that moved to cram-js, a limits-register
 * sentence listing a rAF-coalescing hook under a name nothing has, and an
 * ARCHITECTURE.md hover-channel name that three source comments had kept alive.
 *
 * Strings stay, template substitutions and all. A doc citing `alwaysDrawn` or
 * `methylation` is naming a member of a string-literal union or a config enum,
 * which is as real a symbol as an exported function and lives nowhere else.
 *
 * It SCANS rather than pattern-matches, because what a `/` opens cannot be
 * decided a character at a time. A pair of regexes over the whole file took the
 * slash-star inside a path glob — prose, inside a line comment — for a
 * block-comment opener, and dropped the 260 lines to the next comment close.
 * Repo-wide that lost 154 live names, this file's own `CODE_EXTS` among them,
 * which is the direction that calls a live symbol dead and so reads as a
 * checker bug. The scan therefore tracks what it is inside of: a string, a
 * template (through `${…}`, by brace depth), a regex literal, or code.
 *
 * The one heuristic left is the classic `/` ambiguity, resolved the classic
 * way: a `/` after an identifier, `)`, `]` or `$` divides, and anything else
 * opens a regex. Misreading a division as a regex only widens the set by a few
 * names; the reverse is what lets a `//` inside a regex eat the rest of a line.
 */
export function codeOf(text: string) {
  const n = text.length
  // The brace depth each open `${` returns to, so the `}` that ends a
  // substitution is told apart from the `}` of an object literal inside one.
  const resumeDepth: number[] = []
  let out = ''
  let i = 0
  // The last non-space character emitted, which is all the `/` test needs.
  let prev = ''
  let braces = 0

  // A template body, entered at its opening backtick or at the `}` closing a
  // substitution, and left at the next `${` or the closing backtick.
  const template = () => {
    while (i < n) {
      const c = text[i]!
      if (c === '\\') {
        out += text.slice(i, i + 2)
        i += 2
      } else if (c === '`') {
        out += c
        i++
        return
      } else if (c === '$' && text[i + 1] === '{') {
        out += '${'
        i += 2
        resumeDepth.push(braces)
        return
      } else {
        out += c
        i++
      }
    }
  }

  // A string or regex literal, kept verbatim and never re-read as code.
  const literal = (end: number, tag: string) => {
    out += text.slice(i, end + 1)
    i = end + 1
    prev = tag
  }

  while (i < n) {
    const c = text[i]!
    const next = text[i + 1]
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      out += ' '
      i = end < 0 ? n : end + 2
    } else if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i)
      out += ' '
      i = end < 0 ? n : end
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && text[j] !== c && text[j] !== '\n') {
        j += text[j] === '\\' ? 2 : 1
      }
      literal(j, c)
    } else if (c === '`') {
      out += c
      i++
      template()
      prev = '`'
    } else if (c === '}' && braces === resumeDepth.at(-1)) {
      resumeDepth.pop()
      out += c
      i++
      template()
      prev = '`'
    } else if (c === '/' && !/[\w$)\]]/.test(prev)) {
      let j = i + 1
      let inClass = false
      while (j < n && text[j] !== '\n') {
        const d = text[j]!
        if (d === '/' && !inClass) {
          break
        }
        if (d === '[') {
          inClass = true
        } else if (d === ']') {
          inClass = false
        }
        j += d === '\\' ? 2 : 1
      }
      literal(j, '/')
    } else {
      if (c === '{') {
        braces++
      } else if (c === '}') {
        braces--
      }
      out += c
      if (!/\s/.test(c)) {
        prev = c
      }
      i++
    }
  }
  return out
}
