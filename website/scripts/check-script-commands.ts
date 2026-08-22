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
// `python` and `r` fences are marked the same way and checked the same way,
// because a build script's analysis step is as often a heredoc as a command —
// satuRn behind `dtu`, snapatac2 behind `scatac_pseudobulk`. There the callee
// stands in for the tool and the keyword-argument names stand in for the flags,
// which leaves the values free exactly as the filenames are on the bash side.
// `callArguments.ts` parses those; `shellCommands.ts` parses bash.
//
// An unmarked fence is ignored completely. That is deliberate and not laziness:
// several pages show a route their build script does not take (scrna's
// sinto/deeptools alternative, scatac's four routes), and those have no script
// to be checked against.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { callsAndArgs } from './callArguments.ts'
import { reportProblems } from './check-utils.ts'
import { repoRoot } from './paths.ts'
import { toolsAndFlags } from './shellCommands.ts'

const MARKER = /^<!--\s*from:\s*(\S+?)\s*-->$/

// A build script's own analysis step is as often an R or Python heredoc as it
// is a command, and the page showing that step has the same drift to catch. So
// a marker takes any of the three. Each language names its two halves, so a
// failure reads in the vocabulary of the fence it is about.
//
// The names and the parts are matched with different boundaries because they
// sit differently: a flag is its own word in a script, while a keyword argument
// follows the open paren or a comma as readily as a space.
const CALLS = {
  parse: (body: string) =>
    callsAndArgs(body).map(c => ({ name: c.callee, parts: c.args })),
  // Either side may spell the namespace or module the other drops, so the name
  // is compared bare and matched through whatever qualifies it: the page's
  // `satuRn::fitDTU` has to find the script's, and `snap.ex.export_coverage`
  // has to find a script that imported the module under another alias.
  bare: (name: string) => name.split(/::|\./).pop()!,
  names: (script: string, bare: string) =>
    new RegExp(`(^|[\\s|(/"'.:])${escape(bare)}\\b`, 'm').test(script),
  verb: 'calls',
  part: 'argument',
  // A keyword argument is a bare word, so grepping the script for one is not
  // strong enough to be worth having: `sort` renamed to `order` on the page
  // passed against a script whose python held an unrelated list called `order`.
  // Running the same parser over the script asks the question the check means,
  // which is whether THIS call still takes THAT argument.
  hasPart: (script: string, name: string, part: string) =>
    !!argsOf(script).get(bareName(name))?.has(part),
}

const LANGUAGES: Record<string, typeof CALLS> = {
  bash: {
    parse: (body: string) =>
      toolsAndFlags(body).map(t => ({ name: t.tool, parts: t.flags })),
    bare: (name: string) => name.replace(/\.(py|sh)$/, ''),
    names: runsTool,
    verb: 'runs',
    part: 'flag',
    // A flag carries its own `-`, so nothing else in a script looks like one
    // and the script's text answers for it. `(` counts as leading whitespace: a
    // script collecting its shared flags in an array (`PLINK_ARGS=(--double-id
    // ...)`) passes the first of them on the same word as the paren.
    hasPart: (script: string, _name: string, part: string) =>
      new RegExp(`(^|[\\s(])${escape(part)}(\\b|=)`, 'm').test(script),
  },
  python: CALLS,
  r: CALLS,
}

const bareName = (name: string) => name.split(/::|\./).pop()!

// Every call the script makes, by bare callee, with the argument names it was
// given. Cached because a fence asks once per argument.
const scriptArgs = new Map<string, Map<string, Set<string>>>()

function argsOf(script: string) {
  let found = scriptArgs.get(script)
  if (!found) {
    found = new Map<string, Set<string>>()
    for (const { callee, args } of callsAndArgs(script)) {
      const seen = found.get(bareName(callee)) ?? new Set<string>()
      args.forEach(a => seen.add(a))
      found.set(bareName(callee), seen)
    }
    scriptArgs.set(script, found)
  }
  return found
}

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
    const lang = /^```(\w+)$/.exec((lines[open] ?? '').trim())?.[1]
    const language = lang ? LANGUAGES[lang] : undefined
    if (!language) {
      problems.push(
        `${page}:${i + 1}: from: marker is not above a ` +
          `${Object.keys(LANGUAGES).join('/')} fence`,
      )
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

    // A marker over a fence the parser finds nothing in is the failure this
    // whole check is shaped to avoid: it reports "still runs" forever, over a
    // fence a sabotage cannot redden, and from outside it is indistinguishable
    // from a healthy one. Two got in before this was here, both by accident.
    // `mcscan_synteny_grape_peach` ran `python -m jcvi` in a form the parser
    // dropped, and a fence of nothing but `curl` and `bash` parses empty
    // because both are plumbing.
    //
    // The fix is never to widen the parser to accept the fence, it is to point
    // the marker at a fence that shows a command, or to drop the marker. A
    // route the script does not take is meant to be unmarked.
    const found = language.parse(body)
    if (found.length === 0) {
      problems.push(
        `${page}:${i + 1}: marker asserts nothing — no ${language.verb} ` +
          `found in the fence below it, so it would pass whatever ${spec} ` +
          `does. Mark a fence that shows a command, or drop the marker.`,
      )
      return
    }

    for (const { name, parts } of found) {
      if (!language.names(script, language.bare(name))) {
        problems.push(
          `${page}:${i + 1}: fence ${language.verb} \`${name}\`, ` +
            `which ${spec} does not`,
        )
        continue
      }
      for (const part of parts) {
        if (!language.hasPart(script, name, part)) {
          problems.push(
            `${page}:${i + 1}: \`${name} ${part}\` is not in ${spec} — ` +
              `the script changed, or the page invented this ${language.part}`,
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
