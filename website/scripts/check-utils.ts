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
