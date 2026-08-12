// Keeps every jb2export command in products/jbrowse-img/README.md identical to
// the spec that actually produced the picture underneath it.
//
// The README's figures are rendered by `pnpm screenshots` from the `cliSpec`
// entries in specs/jbrowse-img.ts. Nothing tied those specs to the
// commands the README prints beside them, and they drifted: the SKBR3 coverage
// example documented `--width 1400 --out skbr3_coverage.png` while the figure
// above it was rendered at `--width 1900` and committed as `skbr3_cov.png`. A
// reader running the documented command got a different image, at a different
// size, under a different name.
//
// So the command text is derived rather than duplicated. Opt a fence in by
// putting a marker on the line above it, the same shape sync-doc-snippets.ts
// uses for source includes:
//
//   <!-- jb2export: skbr3_cov -->
//   ```bash
//   …generated from that spec's argv, ending in --out skbr3_cov.png…
//   ```
//   ![alt text](…/img/skbr3_cov.png)
//
// The image line is checked, not generated: its alt text is hand-written and
// worth keeping, but the file it points at has to be the one the command
// writes. It may sit either side of the command — most sections lead with the
// command, the headline leads with the picture.
//
// Fences with no marker are left completely alone, so adding coverage is
// incremental — and because that would otherwise let new hand-written commands
// in unnoticed, `--check` also ratchets: it counts jb2export fences that invoke
// real inputs yet carry no marker, and fails if that total rises above
// UNCOVERED_BASELINE. The number can only go down.
//
// Run `pnpm sync-img-readme` to update, `--check` to fail on drift (CI/autogen).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { readManifest } from './figure-paths.ts'
import { storeUrl } from './figure-store.ts'
import { jbrowseImgSpecs } from './specs/jbrowse-img.ts'

const manifest = readManifest()

const README = join(
  import.meta.dirname,
  '..',
  '..',
  'products',
  'jbrowse-img',
  'README.md',
)
// Where the README's figures are served from, which is now the figure store.
//
// They were raw.githubusercontent URLs into products/jbrowse-img/img, and that
// stopped working the moment figure bytes left git. The site's own
// /jb2/img/jbrowse-img/ path is not an option either: it 404s until a
// production deploy, deploys currently go to /jb2-staging, and this README is
// rendered by GitHub and npm — outside the site entirely — so it cannot depend
// on one having happened.
//
// A store URL is content-addressed, which for a hand-edited file would be a
// maintenance trap: the URL changes whenever the figure does, and a stale one
// shows the wrong picture forever. So it is not hand-edited. This generator
// rewrites each image line's URL from figures.lock, keeping the hand-written
// alt text, and `autogen --check` fails when one has drifted — the same
// treatment the commands beside them already get, for the same reason.
function storeUrlFor(name: string): string | undefined {
  const entry = manifest.get(`products/jbrowse-img/img/${name}.png`)
  return entry ? storeUrl(entry) : undefined
}

const check = process.argv.includes('--check')

// jb2export fences that could render a figure and have no spec behind them.
// Lower this by adding a cliSpec and a marker; never raise it.
const UNCOVERED_BASELINE = 0

const MARKER = /^<!--\s*jb2export:\s*(\S+?)\s*-->$/

const JB_IMG_DIR = join(
  import.meta.dirname,
  '..',
  '..',
  'products',
  'jbrowse-img',
)

// Something that looks like a file rather than a locstring or a modifier:
// `data/volvox/volvox.fa`, `a.chrom.sizes`, `sources.json`. Deliberately does
// not match `ctgA:1-50,000` or `1:1,000,000-1,100,000`, which carry no
// extension, nor `height:200`.
const FILEISH = /^[\w./,-]+\.[a-z0-9]{2,10}(\.(gz|bgz|bz2))?$/i

/**
 * Whether a fence is a command that would actually produce an image, and so
 * ought to have a figure beside it.
 *
 * Asks the filesystem rather than matching a list of placeholder names. That
 * list was the first attempt and it under-matched immediately — `coverage.bw`,
 * `custom_bam.bam`, `sources.json` and `a.chrom.sizes` all read as real, so four
 * illustrative snippets counted as missing figures. A local path either exists
 * in products/jbrowse-img or it stands for one the reader is expected to supply,
 * and that is a question with an answer.
 */
function isRenderable(body: string) {
  if (!/\bjb2export\b/.test(body)) {
    return false
  }
  // a transcript of a command's OUTPUT (`$ jb2export …` followed by an error),
  // and `list`, which prints text
  if (/^\s*\$ /m.test(body) || /\bjb2export\s+list\b/.test(body)) {
    return false
  }
  // a `<contig>`-style stand-in, and a fence running the command more than once
  // — one figure can only come from one command
  if (/<[a-z][\w-]*>/i.test(body) || body.match(/\bjb2export\b/g)!.length > 1) {
    return false
  }
  const tokens = body.split(/\s+/)
  return tokens.every((token, i) => {
    // --out names what the command WRITES, so it never has to exist
    if (tokens[i - 1] === '--out' || !FILEISH.test(token)) {
      return true
    }
    return token.includes('://') || existsSync(join(JB_IMG_DIR, token))
  })
}

const specsByName = new Map(
  jbrowseImgSpecs.map(spec => [spec.name.replace(/^jbrowse-img\//, ''), spec]),
)

// Wrap width for a generated command, counting the two-space continuation
// indent and the trailing ` \`. Long enough that most flags pair up the way a
// person would write them, short enough to stay readable in the npm page.
const WRAP = 78

// A spec's args are argv, i.e. already through the shell. Printing them raw
// gives a command that breaks when pasted — the per-track JSON overrides
// (`{"showOnlyGenes":true}`) are the ones that matter, since bash reads the
// braces and quotes. Quote anything outside the set that is safe bare; URLs,
// locstrings and `key:value` track modifiers all stay unquoted.
const SHELL_SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/

function shellQuote(arg: string) {
  return SHELL_SAFE.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`
}

/**
 * Render a spec's argv the way the README writes commands: `--flag value`
 * groups, packed onto lines up to WRAP characters and continued with a
 * backslash.
 *
 * A token that isn't a flag joins the group before it, which is what keeps a
 * track's inline modifiers (`scaletype:log fill:false …`) and its `{"json"}`
 * overrides attached to the file they modify — and puts a leading subcommand
 * (`dotplot`, `synteny`) on the first line next to the command name. A group
 * longer than WRAP on its own (any of the URLs) simply gets its own line.
 */
function formatCommand(name: string, args: string[]) {
  const groups: string[] = []
  for (const raw of [...args, '--out', `${name}.png`]) {
    const arg = shellQuote(raw)
    if (arg.startsWith('--') || groups.length === 0) {
      groups.push(arg)
    } else {
      groups[groups.length - 1] += ` ${arg}`
    }
  }
  const lines = [
    `jb2export${groups[0]!.startsWith('--') ? '' : ` ${groups.shift()!}`}`,
  ]
  for (const group of groups) {
    const last = lines.length - 1
    if (lines[last]!.length + group.length + 1 <= WRAP) {
      lines[last] += ` ${group}`
    } else {
      lines.push(group)
    }
  }
  return lines.join(' \\\n  ')
}

interface Problem {
  line: number
  message: string
}

const IMAGE = /^!\[[^\]]*\]\((\S+)\)$/

// The nearest image line from `from`, walking `step` and skipping blanks.
// Undefined when the neighbour in that direction is anything else.
function scanImage(lines: string[], from: number, step: number) {
  let j = from
  while (j >= 0 && j < lines.length && !lines[j]!.trim()) {
    j += step
  }
  const m = IMAGE.exec(lines[j] ?? '')
  return m ? { line: j, src: m[1]! } : undefined
}

function sync(source: string) {
  const lines = source.split('\n')
  const out: string[] = []
  const problems: Problem[] = []
  const seen = new Set<string>()
  let uncovered = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    const marked = MARKER.exec(line)
    // oxfmt separates an HTML comment from the fence below it with a blank
    // line, so the marker is not adjacent to what it marks — and this has to
    // emit what the formatter would write, or `autogen --check` and
    // `check-format` each undo the other.
    let fenceAt = i + 1
    while (lines[fenceAt]?.trim() === '') {
      fenceAt++
    }
    const opensFence = lines[fenceAt]?.startsWith('```') ?? false

    if (!marked || !opensFence) {
      // An unmarked fence: count it if it runs a real command, then consume it
      // whole. Advancing one line at a time would re-read its CLOSING delimiter
      // as an opener, pairing it with the next fence and sweeping the prose
      // between them into the body — which counts any paragraph that merely
      // mentions jb2export.
      if (line.startsWith('```')) {
        const close = lines.findIndex((l, j) => j > i && l.startsWith('```'))
        const end = close === -1 ? lines.length - 1 : close
        if (isRenderable(lines.slice(i + 1, end).join('\n'))) {
          uncovered++
        }
        out.push(...lines.slice(i, end + 1))
        i = end + 1
        continue
      }
      out.push(line)
      i++
      continue
    }

    const name = marked[1]!
    const spec = specsByName.get(name)
    if (!spec) {
      problems.push({
        line: i + 1,
        message: `no cliSpec named "${name}" — add one in specs/jbrowse-img.ts or drop the marker`,
      })
      out.push(line)
      i++
      continue
    }
    if (seen.has(name)) {
      problems.push({
        line: i + 1,
        message: `"${name}" is marked twice; one spec renders one figure`,
      })
    }
    seen.add(name)

    // Most sections lead with the command and follow it with the picture; the
    // headline leads with the picture. Look behind before the marker and fence
    // lines are emitted, so the backward scan sees the prose, not them.
    const imageBefore = scanImage(out, out.length - 1, -1)

    // marker, the blank line oxfmt wants, then the opening fence
    out.push(line, '', lines[fenceAt]!)
    const close = lines.findIndex((l, j) => j > fenceAt && l.startsWith('```'))
    if (close === -1) {
      problems.push({ line: fenceAt + 1, message: 'unterminated code fence' })
      i = fenceAt + 1
      continue
    }
    out.push(formatCommand(name, spec.args), lines[close]!)
    i = close + 1

    // Which array the image line lives in decides where the rewrite lands: a
    // figure after the command is still sitting unread in `lines` and will be
    // copied out by the loop below, while one before it has already been
    // emitted into `out`.
    const ahead = scanImage(lines, i, 1)
    const found = ahead
      ? { ...ahead, buf: lines }
      : imageBefore
        ? { ...imageBefore, buf: out }
        : undefined
    if (!found) {
      problems.push({
        line: i,
        message: `"${name}" has no figure beside its command`,
      })
    } else {
      const want = storeUrlFor(name)
      if (!want) {
        problems.push({
          line: found.line + 1,
          message: `"${name}" is not in figures.lock — run \`pnpm figures:push\` so its image has a URL`,
        })
      } else if (found.src !== want) {
        found.buf[found.line] = found.buf[found.line]!.replace(found.src, want)
      }
    }
  }

  return { text: out.join('\n'), problems, uncovered, covered: seen }
}

const original = readFileSync(README, 'utf8')
const { text, problems, uncovered, covered } = sync(original)

const unplaced = [...specsByName.keys()].filter(name => !covered.has(name))
if (unplaced.length > 0) {
  problems.push({
    line: 0,
    message: `cliSpec(s) with no README marker, so nothing shows the command that made them: ${unplaced.join(', ')}`,
  })
}
if (uncovered > UNCOVERED_BASELINE) {
  problems.push({
    line: 0,
    message: `${uncovered} jb2export fences run real inputs with no spec behind them (baseline ${UNCOVERED_BASELINE}). Add a cliSpec + marker rather than raising the baseline.`,
  })
}

for (const { line, message } of problems) {
  console.error(
    line ? `README.md:${line}: ${message}` : `README.md: ${message}`,
  )
}

if (check) {
  if (text !== original) {
    console.error(
      'README.md: a jb2export command no longer matches its spec — run `pnpm sync-img-readme`',
    )
  }
  if (text !== original || problems.length > 0) {
    process.exit(1)
  }
  console.log(
    `sync-img-readme: ${covered.size} command(s) match their spec, ${uncovered} fence(s) still uncovered`,
  )
} else {
  if (problems.length > 0) {
    process.exit(1)
  }
  if (text !== original) {
    writeFileSync(README, text)
    console.log(`sync-img-readme: rewrote ${covered.size} command(s)`)
  } else {
    console.log(`sync-img-readme: ${covered.size} command(s) already in sync`)
  }
}
