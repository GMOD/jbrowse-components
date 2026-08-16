import fs from 'node:fs'
import path from 'node:path'

// An engine built in a `useState` initializer, which is the one React mistake
// every examples site has made and none of them notices.
//
// React double-invokes a state initializer under StrictMode — which is on in
// most app templates, and these files exist to be pasted into one — and throws
// the SECOND result away. For an ordinary value that is the intended lint. For
// an engine it stands up a second MST tree, a second set of autoruns and a
// second worker pool, drops the only reference to it, and leaves it fetching
// with nothing that could ever tear it down. Nothing errors, because the one
// React kept behaves perfectly.
//
// **Every product already publishes the fix, and that was not enough.** The lgv
// site uses `useCreateViewState` in all twenty of its examples; the react-app
// site used it in one file and `useState` in two others, and the circular site
// in none. So the rule gets a check rather than a convention: a helper nobody
// is reminded of is a helper three files skip.
//
// A regex over source rather than an AST walk. The pattern is one line and its
// wrong forms are all one line, so the cost of the crude version is a false
// negative on something written across four lines, which is not how anyone
// writes this.
//
// **Comments are stripped first, and skipping that is not a hypothetical.** The
// fix for each of these files carries a comment naming the shape it replaced —
// "`useCreateViewState`, not `useState(() => createViewState(…))`" — so the
// first version of this check reported all three files it had just been written
// to clear, which is the most confusing way for a new check to fail.
const BUILDERS = /\b(?:createViewState|createLinearGenomeView)\s*\(/
const IN_INITIALIZER = /\buse(?:State|Memo)\s*\(\s*\(\s*\)\s*=>/

// blanked rather than dropped, so a reported line number still points at the
// line the reader will find
function withoutComments(lines: string[]) {
  return lines.map(line =>
    /^\s*(?:\/\/|\/\*|\*)/.test(line) ? '' : line.replace(/\/\/.*$/, ''),
  )
}

export interface EngineHookViolation {
  file: string
  line: number
  text: string
}

/**
 * Report every example that constructs an engine inside a `useState`/`useMemo`
 * initializer. The fix is the product's own `useCreateViewState`, or
 * `useCreateOnce` from `@jbrowse/core/util/hooks` where the example needs to do
 * something to the engine on the way out and the hook's options blob cannot say
 * it.
 */
export function findEnginesBuiltInInitializers(
  exampleDirs: string[],
): EngineHookViolation[] {
  const out: EngineHookViolation[] = []
  for (const dir of exampleDirs) {
    if (!fs.existsSync(dir)) {
      continue
    }
    for (const name of fs.readdirSync(dir).filter(f => f.endsWith('.tsx'))) {
      const file = path.join(dir, name)
      const raw = fs.readFileSync(file, 'utf8').split('\n')
      const code = withoutComments(raw)
      code.forEach((line, i) => {
        // the two on one line is the plain form; the multi-line form opens the
        // initializer and calls the builder within the next few lines, which is
        // what the lookahead covers
        const window = code.slice(i, i + 4).join('\n')
        if (IN_INITIALIZER.test(line) && BUILDERS.test(window)) {
          out.push({ file, line: i + 1, text: raw[i]!.trim() })
        }
      })
    }
  }
  return out
}
