// Splitting a documented shell snippet into the invocations it runs, for
// `check-script-commands`.
//
// Split out of that script so it can be tested, for the same reason
// docFenceRegions was: the failure mode is silent and self-confirming. This
// parser feeds a check that asserts every tool the page shows still runs in the
// build script. A parser that quietly finds NO tools makes that check pass on
// every page forever, and a passing check is indistinguishable from a correct
// one from the outside. So the cases it has to get right are pinned in tests
// rather than left to the corpus happening to exercise them.

// Shell builtins and control words, plus the plumbing whose flags belong to
// quickstart_web rather than to any build script.
const IGNORED = new Set([
  'cd',
  'echo',
  'export',
  'for',
  'do',
  'done',
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'while',
  'set',
  'local',
  'return',
  'exit',
  'read',
  'printf',
  'cat',
  'mkdir',
  'rm',
  'mv',
  'cp',
  'test',
  'source',
  'eval',
  'trap',
  'shift',
  'curl',
  'wget',
  'npx',
  'node',
  'bash',
  'sh',
])

/**
 * Split a shell snippet into invocations.
 *
 * Quote state is tracked across lines so the body of a multi-line `awk '…'`
 * program is not read as a series of commands, and backslash continuations are
 * joined so a wrapped command stays one. Both were false positives on the first
 * real run rather than hypotheticals: an awk program's `end=$2+2000;` and a
 * continuation's `gt=chr1.gt.vcf.gz` each parsed as a tool the script "did not
 * run", which is the shape of noise that gets a check deleted.
 */
export function invocations(body: string) {
  const out: string[] = []
  let current = ''
  let quote: string | null = null

  for (const raw of body.split('\n')) {
    // A comment only counts outside quotes; inside an awk program `#` is data.
    // Both annotations break an inference cycle: `quote` is assigned from `c`,
    // `c` comes from `line`, and `line` is chosen by `quote`.
    const line: string = quote ? raw : raw.replace(/(^|\s)#.*$/, '')
    for (let i = 0; i < line.length; i++) {
      const c: string = line[i]!
      if (quote) {
        if (c === quote) {
          quote = null
        }
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '|' || c === ';') {
        out.push(current)
        current = ''
        continue
      }
      current += c
    }
    if (quote) {
      current += '\n'
      continue
    }
    if (current.trimEnd().endsWith('\\')) {
      current = `${current.trimEnd().slice(0, -1)} `
      continue
    }
    out.push(current)
    current = ''
  }
  out.push(current)
  return out.filter(s => s.trim())
}

/**
 * The tool each invocation runs and the flags it passes, skipping shell
 * builtins, `VAR=value` prefixes and anything that is not a command word.
 */
export function toolsAndFlags(body: string) {
  const found: { tool: string; flags: string[] }[] = []
  for (const invocation of invocations(body)) {
    const words = invocation.trim().split(/\s+/).filter(Boolean)
    // Leading `VAR=value` assignments are not the command.
    let at = 0
    while (words[at] && /^[A-Za-z_]\w*=/.test(words[at]!)) {
      at++
    }
    const tool = words[at]
    if (!tool || IGNORED.has(tool) || /^[-$"'({]/.test(tool)) {
      continue
    }
    found.push({
      tool,
      flags: words.slice(at).filter(w => /^--?[A-Za-z][\w-]*$/.test(w)),
    })
  }
  return found
}
