// Splitting a documented Python or R snippet into the calls it makes, for
// `check-script-commands`.
//
// Same job `shellCommands` does for bash, and split out for the same reason: a
// parser that quietly finds nothing makes the check that uses it pass forever,
// and a passing check looks identical to a correct one from outside. The cases
// it has to get right are pinned in `callArguments.test.ts`.
//
// Python and R share one shape here. A documented analysis step is a call with
// named arguments — `snap.ex.export_coverage(groupby="cell_type", bin_size=25)`,
// `satuRn::fitDTU(object = se, formula = ~ 0 + tissue)` — so the callee plays
// the part bash's tool plays and the argument NAMES play the part its flags
// play. Values stay free, exactly as filenames do on the bash side, because the
// page carries the general form and the script the pinned one.

// Callees that carry no analysis: loading a library, reading a table, printing.
// A page showing one of these is not showing the step the check exists to pin,
// and requiring the script to spell it the same way fails on the R-and-Python
// spellings of the same idea.
const IGNORED = new Set([
  'c',
  'cat',
  'data.frame',
  'dict',
  'float',
  // R spells a definition `function(x)`, whose callee reads as `function`.
  'function',
  'int',
  'len',
  'library',
  'list',
  'matrix',
  'open',
  'print',
  'range',
  'read.delim',
  'require',
  'str',
  'sum',
  'suppressPackageStartupMessages',
])

/**
 * The callee of each call in a snippet and the names of its keyword arguments.
 *
 * Nested calls each come back on their own, since a step is as often written as
 * an argument to another call as it is on its own line. Only arguments at a
 * call's own depth belong to it: `fitDTU(object = se, formula = f(x = 1))`
 * gives `fitDTU` the names `object` and `formula`, and `f` the name `x`.
 */
export function callsAndArgs(body: string) {
  const src = stripComments(body)
  const found: { callee: string; args: string[] }[] = []

  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '(') {
      continue
    }
    const before = src.slice(0, i)
    const name = /([A-Za-z_.][\w.]*(?:::[\w.]+)?)\s*$/.exec(before)
    // A `def`/`function` header names the same shape as a call and is not one.
    if (
      !name ||
      /\b(def|class|function)\s*$/.test(before.slice(0, name.index))
    ) {
      continue
    }
    const callee = name[1]!
    const bare = callee.split(/::|\./).pop()!
    if (IGNORED.has(bare) || IGNORED.has(callee)) {
      continue
    }
    found.push({ callee, args: argNames(src, i) })
  }
  return found
}

/** Keyword-argument names at the top level of the arg list opening at `open`. */
function argNames(src: string, open: number) {
  const args: string[] = []
  let depth = 0
  let quote: string | null = null
  let word = ''

  for (let i = open; i < src.length; i++) {
    const c = src[i]!
    if (quote) {
      if (c === quote) {
        quote = null
      }
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      word = ''
      continue
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++
      word = ''
      continue
    }
    if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth === 0) {
        return args
      }
      word = ''
      continue
    }
    // `==`, `<=`, `!=` and R's `<-` are comparison and assignment. Only a bare
    // `=` at the call's own depth names an argument.
    const nextIsEq = src[i + 1] === '='
    const prevIsOp = '=!<>'.includes(src[i - 1] ?? '')
    if (depth === 1 && c === '=' && !nextIsEq && !prevIsOp) {
      const named = /^\s*([A-Za-z_.][\w.]*)\s*$/.exec(word)
      if (named) {
        args.push(named[1]!)
      }
      word = ''
      continue
    }
    word = c === ',' ? '' : word + c
  }
  return args
}

/** Drop `#` comments, which both languages spell the same way. */
function stripComments(body: string) {
  return body
    .split('\n')
    .map(line => {
      let quote: string | null = null
      for (let i = 0; i < line.length; i++) {
        const c = line[i]!
        if (quote) {
          if (c === quote) {
            quote = null
          }
        } else if (c === '"' || c === "'") {
          quote = c
        } else if (c === '#') {
          return line.slice(0, i)
        }
      }
      return line
    })
    .join('\n')
}
