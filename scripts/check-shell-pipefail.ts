// Flags `| head` in a shell script running `set -o pipefail`, which is a way to
// exit 141 rather than a way to print the first N lines.
//
// `sort … | head -5 | awk …` reads as "the top five rows". head closes the pipe
// as soon as it has them, sort dies of SIGPIPE, `pipefail` promotes 141 to the
// pipeline's status, and `set -e` aborts the script there. The construction is
// almost always in a *print a summary table* step, so the run ends having
// printed something that looks like completion and everything after it silently
// never happens.
//
// That is not hypothetical: five instances across four `scripts/build_*.sh` and
// `scan_hic_translocation.sh` were each cutting their script off mid-run, one of
// them before both plink tables its tutorial cites as "what the script prints"
// and before the JBrowse app the script is supposed to end in. Every one had
// been in the tree for months, because the failure looks exactly like success.
//
// The fix is to let awk do the head — `awk 'NR<=5'`, or `awk -v n="$N" 'NR<=n'`
// — since awk reads its input to EOF and never closes the pipe early.
//
// NOT FLAGGED, because `set -e` is suspended for a command whose status is being
// tested: `if cmd | grep -q x; then`. There the early exit is the point and the
// SIGPIPE is consumed by the condition. Same for `while`/`until`/`&&`/`||`.
//
// SEPARATE FROM `scripts/check-build-scripts.py`, which guards the same scripts
// with `bash -n`, shellcheck and heredoc validation, for two reasons: shellcheck
// 0.11 does not diagnose this (verified against the exact construction above),
// and that checker's remit is `build_*.sh`, while two of the five instances were
// in `scan_hic_translocation.sh`. This one reads every tracked `*.sh`.
//
// Run: pnpm check-shell-pipefail
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

// Producers small enough that they finish writing before the consumer can close
// the pipe. `echo`/`printf` are builtins emitting a line or two; flagging them
// would be noise nobody can act on.
const TINY_PRODUCER = /^\s*(\w+=)?\$?\(?\s*(echo|printf)\b/

// A line whose pipeline's exit status is being consumed rather than checked by
// `set -e`.
const STATUS_CONSUMED = /^\s*(if|elif|while|until)\b|(\|\||&&)\s*$/

const files = execFileSync('git', ['ls-files', '*.sh'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)

const problems: string[] = []
for (const rel of files) {
  const text = readFileSync(join(root, rel), 'utf8')
  if (!/set\s+-[a-z]*o\s+pipefail|set\s+-o\s+pipefail/.test(text)) {
    continue
  }
  text.split('\n').forEach((line, i) => {
    // strip a trailing comment so `# … | head -5 …` in an explanation does not
    // trip the check that explanation is about
    const code = line.replace(/#.*$/, '')
    if (!/\|\s*head\b/.test(code)) {
      return
    }
    if (TINY_PRODUCER.test(code) || STATUS_CONSUMED.test(code)) {
      return
    }
    problems.push(
      `${rel}:${i + 1}: \`| head\` under \`set -o pipefail\` exits 141 and aborts the script.\n` +
        `  ${line.trim()}\n` +
        `  Let awk do the head instead: \`| awk 'NR<=N'\`.`,
    )
  })
}

if (problems.length) {
  console.error(problems.join('\n\n'))
  console.error(`\n${problems.length} pipefail/head problem(s).`)
  process.exit(1)
}
console.log(
  `${files.length} shell script(s) checked, no \`| head\` under pipefail.`,
)
