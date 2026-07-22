// Keeps a doc's fenced code blocks identical to real, compiled source.
//
// A hand-copied fence drifts silently: the example plugin can typecheck while
// the guide beside it teaches an undefined type or a renamed API, and no check
// in the repo can see the difference (check-doc-imports validates import
// *specifiers*, not the code around them).
//
// Opt in per fence by putting an include marker on the line above it:
//
//   <!-- include: example-plugins/score-example/src/ScoreRPC/GetScoreData.ts -->
//   ```ts
//   …generated: replaced with that file's contents…
//   ```
//
// For part of a file, mark a region in the source and reference it with `#`:
//
//   // #region execute            <!-- include: path/to/file.ts#execute -->
//   …
//   // #endregion
//
// Region bodies are dedented; the marker lines themselves are never emitted.
// Fences with no marker are left completely alone, so migration is incremental.
//
// Run `pnpm sync-doc-snippets` to update, `--check` to fail on drift (CI).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { walkFiles } from './check-utils.ts'

const root = join(import.meta.dirname, '..', '..')
const docsDir = join(import.meta.dirname, '..', 'docs')
const check = process.argv.includes('--check')

const MARKER = /^<!--\s*include:\s*(\S+?)\s*-->$/

function extractRegion(source: string, file: string, region: string) {
  const lines = source.split('\n')
  const start = lines.findIndex(l =>
    new RegExp(`^\\s*(//|#)\\s*#region\\s+${region}\\b`).test(l),
  )
  if (start === -1) {
    throw new Error(`${file}: no "#region ${region}"`)
  }
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(l => /^\s*(\/\/|#)\s*#endregion\b/.test(l))
  if (end === -1) {
    throw new Error(`${file}: "#region ${region}" has no "#endregion"`)
  }
  const body = rest
    .slice(0, end)
    .filter(l => !/^\s*(\/\/|#)\s*#(end)?region\b/.test(l))
  const indent = Math.min(
    ...body.filter(l => l.trim()).map(l => l.length - l.trimStart().length),
  )
  return body.map(l => l.slice(indent)).join('\n')
}

function resolve(spec: string) {
  const [file, region] = spec.split('#')
  const source = readFileSync(join(root, file!), 'utf8')
  return region
    ? extractRegion(source, file!, region)
    : // whole-file includes keep the trailing newline out of the fence
      source.replace(/\n+$/, '')
}

const problems: string[] = []
const stale: string[] = []

for (const path of walkFiles(docsDir, n => n.endsWith('.md'))) {
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n')
  const out: string[] = []
  let changed = false

  for (let i = 0; i < lines.length; i++) {
    const marker = MARKER.exec(lines[i]!.trim())
    out.push(lines[i]!)
    if (!marker || !lines[i + 1]?.startsWith('```')) {
      continue
    }
    const fenceOpen = lines[i + 1]!
    const closeAt = lines.indexOf('```', i + 2)
    if (closeAt === -1) {
      problems.push(`${path}: unterminated fence after ${marker[1]}`)
      continue
    }
    let body: string
    try {
      body = resolve(marker[1]!)
    } catch (e) {
      problems.push(`${path}: ${String(e)}`)
      continue
    }
    const current = lines.slice(i + 2, closeAt).join('\n')
    if (current !== body) {
      changed = true
    }
    out.push(fenceOpen, ...body.split('\n'), '```')
    i = closeAt
  }

  if (changed) {
    stale.push(path.replace(`${root}/`, ''))
    if (!check) {
      writeFileSync(path, out.join('\n'))
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'))
  process.exit(1)
}
if (stale.length > 0) {
  if (check) {
    console.error(
      `Doc snippets are out of date with their source:\n${stale
        .map(s => `  ${s}`)
        .join('\n')}\nRun 'pnpm sync-doc-snippets' and commit the result.`,
    )
    process.exit(1)
  }
  for (const s of stale) {
    console.log(`  updated: ${s}`)
  }
} else {
  console.log('All doc snippet includes match their source.')
}
