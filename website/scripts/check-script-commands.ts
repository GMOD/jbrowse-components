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
import { toolsAndFlags } from './shellCommands.ts'

const MARKER = /^<!--\s*from:\s*(\S+?)\s*-->$/

const problems: string[] = []

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
      if (!runsTool(script, bare)) {
        problems.push(
          `${page}:${i + 1}: fence runs \`${tool}\`, which ${spec} does not`,
        )
        continue
      }
      for (const flag of flags) {
        // `(` counts as leading whitespace here: a script collecting its shared
        // flags in an array (`PLINK_ARGS=(--double-id ...)`) passes the first of
        // them on the same word as the paren.
        if (!new RegExp(`(^|[\\s(])${escape(flag)}(\\b|=)`, 'm').test(script)) {
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

// A build script may run a tool through an overridable variable — plink is
// `PLINK="${PLINK:-plink}"` because Debian ships it as plink1.9 — and the name
// is then never a command word for the first pattern to find. The tool the
// script runs is the tool it runs, so a variable defaulting to it counts.
function runsTool(script: string, bare: string) {
  return (
    new RegExp(`(^|[\\s|(/"'])${escape(bare)}\\b`, 'm').test(script) ||
    new RegExp(`\\$\\{\\w+:?-${escape(bare)}\\}`, 'm').test(script)
  )
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
