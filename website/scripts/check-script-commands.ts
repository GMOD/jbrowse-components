// Keeps a tutorial's shell commands honest against the build script they were
// lifted out of.
//
// `sync-doc-snippets` solves this for TS by generating the fence from source,
// and deliberately does not cover `bash` — its CODE_FENCE_LANGS comment says a
// bash command "has no source to point at". That was true while the only shell
// in the docs was ad hoc. It stopped being true once the tutorials started
// showing the command that produces each page's subject file, because that
// command is in `scripts/build_*.sh`, running in CI's shellcheck pass.
//
// Generating those fences from the script is still wrong, though, and the
// reason is the rule that put them there (`docs/tutorials/CLAUDE.md`): the page
// carries the GENERAL form, `bwameth.py --reference ref.fa R1.fq.gz`, where the
// script carries the pinned one, `"$REF" "$FQ1"` against a fixed SRA run. A
// verbatim include would drag `$OUTDIR`, `$CHROM` and the accessions back onto
// the page and undo the generalization.
//
// So this checks the part that must agree rather than the text: every tool and
// every flag the page shows still has to appear in the script. That catches the
// drift that actually happens — a flag renamed, a step dropped, a tool swapped
// for another — while leaving filenames, values and layout free.
//
// Opt in per fence, so nothing else in the corpus is disturbed:
//
//   <!-- from: scripts/build_arabidopsis_wgbs.sh -->
//   ```bash
//   bwameth.py --reference tair10.fa -t 8 R1_val_1.fq.gz R2_val_2.fq.gz
//   ```
//
// An unmarked fence is ignored completely. That is deliberate and not laziness:
// several pages show a route their build script does not take (scrna's
// sinto/deeptools alternative, scatac's four routes), and those have no script
// to be checked against.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'

const MARKER = /^<!--\s*from:\s*(\S+?)\s*-->$/

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

const problems: string[] = []

/**
 * Split a shell snippet into invocations, tracking quotes so that the body of a
 * multi-line `awk '…'` program is not read as a series of commands, and joining
 * backslash continuations so a wrapped command stays one.
 *
 * Every one of those was a false positive on the first run rather than a
 * hypothetical: an awk program's `end=$2+2000;` and a continuation's
 * `gt=chr1.gt.vcf.gz` both parsed as tools the script did not run.
 */
function invocations(body: string) {
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
      current = current.trimEnd().slice(0, -1) + ' '
      continue
    }
    out.push(current)
    current = ''
  }
  out.push(current)
  return out
}

function toolsAndFlags(body: string) {
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

export function checkPage(mdPath: string) {
  const src = readFileSync(mdPath, 'utf8')
  const lines = src.split('\n')
  const page = relative(repoRoot, mdPath)

  lines.forEach((line, i) => {
    const marker = MARKER.exec(line.trim())
    if (!marker) {
      return
    }
    const spec = marker[1]!
    const scriptPath = join(repoRoot, spec)
    if (!existsSync(scriptPath)) {
      problems.push(`${page}:${i + 1}: from: ${spec} does not exist`)
      return
    }
    // The markdown formatter puts a blank line between a marker and its fence,
    // exactly as it does for sync-doc-snippets' `include:`.
    let open = i + 1
    while ((lines[open] ?? '').trim() === '') {
      open++
    }
    if (!/^```bash$/.test((lines[open] ?? '').trim())) {
      problems.push(`${page}:${i + 1}: from: marker is not above a bash fence`)
      return
    }
    const close = lines.indexOf('```', open + 1)
    if (close === -1) {
      problems.push(`${page}:${i + 1}: unterminated fence`)
      return
    }
    const body = lines.slice(open + 1, close).join('\n')
    // Comments are stripped from the script too: a flag named only in a comment
    // there is not a flag the script runs, and several of these scripts discuss
    // in their headers the very flags they went on to drop.
    const script = readFileSync(scriptPath, 'utf8')
      .split('\n')
      .filter(l => !/^\s*#/.test(l))
      .join('\n')

    for (const { tool, flags } of toolsAndFlags(body)) {
      const bare = tool.replace(/\.(py|sh)$/, '')
      if (!new RegExp(`(^|[\\s|(/"'])${escape(bare)}\\b`, 'm').test(script)) {
        problems.push(
          `${page}:${i + 1}: fence runs \`${tool}\`, which ${spec} does not`,
        )
        continue
      }
      for (const flag of flags) {
        if (!new RegExp(`(^|\\s)${escape(flag)}(\\b|=)`, 'm').test(script)) {
          problems.push(
            `${page}:${i + 1}: \`${tool} ${flag}\` is not in ${spec} — ` +
              `the script changed, or the page invented a flag`,
          )
        }
      }
    }
  })
}

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const tutorials = join(repoRoot, 'website/docs/tutorials')
for (const name of readdirSync(tutorials)) {
  if (name.endsWith('.md') && name !== 'CLAUDE.md') {
    checkPage(join(tutorials, name))
  }
}

reportProblems(
  problems,
  'Every marked tutorial command still runs in the script it came from.',
)
