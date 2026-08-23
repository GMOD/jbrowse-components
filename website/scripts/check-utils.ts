// Shared helpers for the website's CI "up-to-date"/validation scripts
// (generate-*, gen-*, check-*). Each generator supports a `--check` mode that
// fails CI when its committed output is stale rather than rewriting it, and each
// validator walks the docs tree collecting problems — this centralizes the
// boilerplate all of them repeated.
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { repoRoot } from './paths.ts'

// True when invoked with `--check` (CI parity mode); false for a local rewrite.
export const check = process.argv.includes('--check')

// Recursively collect absolute paths of files under `dir` whose basename passes
// `match`, skipping any directory named in `skipDirs`.
export function walkFiles(
  dir: string,
  match: (name: string) => boolean,
  skipDirs = new Set<string>(),
): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return skipDirs.has(entry.name) ? [] : walkFiles(full, match, skipDirs)
    }
    return match(entry.name) ? [full] : []
  })
}

/**
 * Exit with a legible message when a directory a check is about to walk does
 * not exist. Several of these checks read the BUILT site, and without this
 * `walkFiles` falls straight into node:fs and prints a `scandir` stack — which
 * reads as a broken script rather than as "you have not run `pnpm build`", and
 * the wrong one of those gets acted on. `hint` carries the build advice for the
 * default dist path, so a check that also accepts a directory argument does not
 * tell someone to build when they simply mistyped a path.
 */
export function assertDirExists(dir: string, hint?: string) {
  if (!existsSync(dir)) {
    console.error(hint ? `${dir} not found — ${hint}` : `${dir} not found`)
    process.exit(1)
  }
}

// statSync guarded against a missing path.
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

/**
 * The `agent-docs/` pages a website page LINKS, in either of the two forms a
 * page can write one — a GitHub blob URL, or a repo-root-relative markdown
 * target.
 *
 * Shared by `sync-measurements` (a page publishing a doc's table has to link
 * that doc) and `check-quoted-figures` (a figure has to appear in a doc the page
 * links). One definition because the two must agree: a bare path in prose
 * satisfying one and not the other leaves a page that publishes a table, names
 * its source, and still gives the reader nothing to click.
 */
export function linkedAgentDocs(text: string) {
  const found = new Set<string>()
  for (const m of text.matchAll(
    /(?:blob\/main\/|\]\(\/?)(agent-docs\/[\w./-]+\.md)/g,
  )) {
    found.add(m[1]!)
  }
  return found
}

// Build output, which is never an input to any of these. Gitignored, so a
// developer with a stale local build and a CI runner with none at all would
// otherwise disagree about what exists.
export const BUILD_DIRS = new Set([
  'node_modules',
  'dist',
  'esm',
  'cjs',
  'build',
])

// A published doc page. CLAUDE.md files are agent instructions rather than
// pages, and they *describe* the marker syntax the generators scan for
// (`<!-- GOTCHA <ConfigName> START -->`), so a generator that reads them parses
// its own documentation as real input — which is how `pnpm gendocs` once died
// on the placeholder name `<ConfigName>`.
export function isDocFile(name: string): boolean {
  return name.endsWith('.md') && name !== 'CLAUDE.md'
}

// A non-test TypeScript source, for the generators that read tags straight out
// of source text rather than through the TypeScript program.
export function isTsSource(name: string): boolean {
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)
}

// Every published doc page under a directory.
export function docFiles(dir: string): string[] {
  return walkFiles(dir, isDocFile)
}

const KEY_LINE = /^([A-Za-z_][\w-]*):(.*)$/

// Strip one matched pair of surrounding quotes. Only the ADR `summary:` values
// are quoted today, and one of them carries escaped inner quotes.
function unquote(value: string): string {
  const quote = value[0]
  if (
    value.length > 1 &&
    (quote === '"' || quote === "'") &&
    value.endsWith(quote)
  ) {
    const inner = value.slice(1, -1)
    return quote === '"'
      ? inner.replaceAll('\\"', '"').replaceAll('\\\\', '\\')
      : inner
  }
  return value
}

// The `---`-delimited frontmatter block as a flat key/value map, or undefined
// when the file has none — so a caller that requires frontmatter can throw its
// own message and one that tolerates its absence can default.
//
// There were four of these, each a subset of this one, and the differences were
// silent rather than deliberate: two truncated a wrapped `description:` at its
// first newline, two left an ADR's quoted `summary:` with its quotes on. A
// value therefore runs to the next `key:` line — continuation lines are
// re-flowed onto it with single spaces, which is what a table cell wants.
export function parseFrontmatter(
  content: string,
): Record<string, string> | undefined {
  const match = /^---\n([\s\S]*?)\n---/.exec(content)
  if (!match) {
    return undefined
  }
  const result: Record<string, string> = {}
  let key: string | undefined
  for (const line of match[1]!.split('\n')) {
    const kv = KEY_LINE.exec(line)
    if (kv) {
      key = kv[1]!
      result[key] = unquote(kv[2]!.trim())
    } else if (key !== undefined && line.trim()) {
      result[key] += ` ${line.trim()}`
    }
  }
  return result
}

// Compact pipe table, as lines. The generated index pages want it dense: the
// formatter otherwise pads every cell out to its column's widest member, so one
// long description reflows every row into the diff.
//
// Named for its return type because api-docs/util.ts exports a `markdownTable`
// of its own, with the same parameters and a different return (one joined
// string, led by a `prettier-ignore`), and that file imports this one — so the
// two were a single mistaken import away from a table rendered as
// `[object Object]` or a `.join` on a string.
export function markdownTableLines(
  headers: string[],
  rows: string[],
): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows,
  ]
}

// Replace the region between `<!-- BEGIN GENERATED <marker> -->` and its END
// twin, leaving the hand-maintained prose around it alone. The marker text is
// built here rather than passed in whole so the convention has one spelling.
export function spliceGeneratedBlock({
  path,
  marker,
  body,
  text,
}: {
  path: string
  marker: string
  body: string[]
  // The file's current content, when the caller is mid-way through splicing
  // several blocks into one page and the previous splice is not on disk yet.
  // Defaults to reading `path`, which is every single-block caller. `path` is
  // still required either way: every error below names it.
  text?: string
}): string {
  const begin = `<!-- BEGIN GENERATED ${marker} -->`
  const end = `<!-- END GENERATED ${marker} -->`
  const existing = text ?? readFileSync(path, 'utf8')
  const from = existing.indexOf(begin)
  const to = existing.indexOf(end)
  if (from === -1 || to === -1) {
    throw new Error(`${path}: missing ${begin} / ${end} markers`)
  }
  // Both authoring mistakes below produce a plausible-looking file rather than
  // an error, which is why they are checked rather than commented about. An END
  // above its BEGIN splices the table into the middle of the prose and deletes
  // whatever sat between them; a second pair is simply never regenerated, and
  // `--check` agrees the file is current because the text it compares is the
  // same either way.
  if (to < from) {
    throw new Error(`${path}: ${end} appears above ${begin}`)
  }
  if (existing.includes(begin, from + 1)) {
    throw new Error(
      `${path}: more than one ${begin} — only the first would be regenerated`,
    )
  }
  return (
    existing.slice(0, from) +
    [begin, '', ...body, ''].join('\n') +
    existing.slice(to)
  )
}

interface Generated {
  path: string
  content: string
  label: string
}

// The `--check`/write dance every generator repeated: in check mode fail with
// `staleHint` when a committed file differs from its freshly-generated
// `content`; otherwise write it.
//
// Every artifact is judged before anything exits, so one run names all of them.
// Exiting on the first stale file is the failure mode scripts/autogen.ts exists
// to end — a run that reports only the first problem turns "regenerate and
// commit" into fix, push, discover the next one. It was live here: the three
// guide indexes are generated in one loop, so a stale `user_guide.md` hid a
// stale `developer_guide.md` behind it.
export function checkOrWriteAll(generated: Generated[], staleHint: string) {
  if (!check) {
    for (const { path, content } of generated) {
      writeFileSync(path, content)
      console.log(`wrote ${path}`)
    }
    return
  }
  const stale = generated.filter(
    ({ path, content }) => readFileSync(path, 'utf8') !== content,
  )
  if (stale.length > 0) {
    console.error(
      stale.length === 1
        ? `${stale[0]!.label} is out of date — ${staleHint}`
        : `${stale.length} generated files are out of date — ${staleHint}:\n${stale
            .map(g => `  ${g.label}`)
            .join('\n')}`,
    )
    process.exit(1)
  }
  for (const { label } of generated) {
    console.log(`${label} is up to date`)
  }
}

// One artifact, the common case.
export function checkOrWrite({
  staleHint,
  ...generated
}: Generated & { staleHint: string }) {
  checkOrWriteAll([generated], staleHint)
}

// The base path a built `dist/` actually emitted its links under, read back off
// the home page as the most common first segment of its root-absolute hrefs.
function emittedBase(distDir: string): string | undefined {
  const home = join(distDir, 'index.html')
  if (!isFile(home)) {
    return undefined
  }
  const counts = new Map<string, number>()
  for (const match of readFileSync(home, 'utf8').matchAll(
    /(?:href|src)="(\/[^"/][^"]*)"/g,
  )) {
    const segment = match[1]!.split('/')[1]!
    counts.set(`/${segment}`, (counts.get(`/${segment}`) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
}

// Exit with an actionable message when `distDir` was built for a different base
// than the checker is about to use. A checker's BASE is only a guess about how
// the tree in front of it was built, and `deploy_staging.sh` builds with
// SITE_BASE_PATH=/jb2-staging. Checking that tree under the default reports the
// entire site as broken (check-links) or filters every link out and passes
// vacuously (check-llms), neither of which names the actual problem.
export function assertBaseMatches(distDir: string, base: string) {
  const built = emittedBase(distDir)
  if (built !== undefined && built !== base) {
    console.error(
      `dist/ links are under ${built}, but this check is using ${base}.\n` +
        `Re-run with SITE_BASE_PATH=${built}, or rebuild with \`pnpm build\`.`,
    )
    process.exit(1)
  }
}

// oxfmt is the repo's formatter (`pnpm format`), so running it is what decides
// the committed bytes of anything a generator writes.
//
// Resolved through node's resolver rather than spawned by name: the shell-out
// this replaced found its binary only via the PATH an npm script sets, so
// running a generator with plain `node` spawned ENOENT and silently formatted
// nothing. Resolved from the repo root rather than from `import.meta.url`,
// which keeps `import.meta` out of a module jest transforms to CJS.
export function oxfmtBin(): string {
  return join(
    dirname(
      createRequire(join(repoRoot, 'package.json')).resolve(
        'oxfmt/package.json',
      ),
    ),
    'bin',
    'oxfmt',
  )
}

// Format generated markdown as a string, the way `pnpm format` would format the
// file it is about to be written to.
//
// A generator that mirrors one committed file into another compares its output
// byte-for-byte against what is on disk, and `pnpm format` rewrites that file
// too — so whatever formats here has to agree with the repo formatter or the
// two fight and `--check` oscillates. This used to be a prettier call in each
// generator, which agreed with oxfmt on markdown by observation rather than by
// construction. `--stdin-filepath` is how oxfmt picks its parser, so the path
// matters even though nothing is read from it.
export function formatMarkdown(text: string, filepath: string): string {
  // `cwd: repoRoot`, and the binary resolved from there too, because oxfmt
  // reads its config from the directory it is SPAWNED in: the same text
  // formatted from website/ and from the repo root came out differently (a
  // frontmatter line wrapped in one and not the other), so `pnpm autogen` and a
  // generator run by hand from website/ disagreed and cli.md oscillated between
  // them. `pnpm format` runs from the root, so the root is the answer.
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [oxfmtBin(), `--stdin-filepath=${filepath}`],
    {
      input: text,
      encoding: 'utf8',
      cwd: repoRoot,
      maxBuffer: 64 * 1024 * 1024,
    },
  )
  if (status !== 0) {
    throw new Error(`oxfmt failed on ${filepath}: ${stderr}`)
  }
  return stdout
}

// The collect-then-report tail every validator repeated: print `errorLines` and
// exit(1) when non-empty, otherwise log the success message.
export function reportProblems(errorLines: string[], ok: string) {
  if (errorLines.length > 0) {
    console.error(errorLines.join('\n'))
    process.exit(1)
  } else {
    console.log(ok)
  }
}
