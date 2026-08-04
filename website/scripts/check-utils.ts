// Shared helpers for the website's CI "up-to-date"/validation scripts
// (generate-*, gen-*, check-*). Each generator supports a `--check` mode that
// fails CI when its committed output is stale rather than rewriting it, and each
// validator walks the docs tree collecting problems — this centralizes the
// boilerplate all of them repeated.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

// statSync guarded against a missing path.
export function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

// The `--check`/write dance every generator repeated: in check mode fail with
// `staleHint` when the committed file differs from freshly-generated `content`;
// otherwise write it.
export function checkOrWrite({
  path,
  content,
  label,
  staleHint,
}: {
  path: string
  content: string
  label: string
  staleHint: string
}) {
  if (check) {
    if (readFileSync(path, 'utf8') !== content) {
      console.error(`${label} is out of date — ${staleHint}`)
      process.exit(1)
    }
    console.log(`${label} is up to date`)
  } else {
    writeFileSync(path, content)
    console.log(`wrote ${path}`)
  }
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
