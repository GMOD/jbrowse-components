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
// Because unmarked fences are ignored, nothing would otherwise stop a *new*
// hand-written one appearing. `--check` therefore also ratchets: it counts the
// un-included TS/JS fences under developer_guides and fails if that total rises
// above DOC_FENCE_BASELINE, so the debt can only shrink.
//
// Run `pnpm sync-doc-snippets` to update, `--check` to fail on drift (CI).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { walkFiles } from './check-utils.ts'

const root = join(import.meta.dirname, '..', '..')
const docsDir = join(import.meta.dirname, '..', 'docs')
const guidesDir = join(docsDir, 'developer_guides')
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
  const body = rest.slice(0, end).filter(l => !REGION_MARKER.test(l))
  const indent = Math.min(
    ...body.filter(l => l.trim()).map(l => l.length - l.trimStart().length),
  )
  return body.map(l => l.slice(indent)).join('\n')
}

const REGION_MARKER = /^\s*(\/\/|#)\s*#(end)?region\b/

function resolve(spec: string) {
  const [file, region] = spec.split('#')
  const source = readFileSync(join(root, file!), 'utf8')
  if (region) {
    return extractRegion(source, file!, region)
  }
  // A whole-file include still drops the region markers: they exist so *other*
  // docs can pull a slice, and they'd read as noise here.
  return source
    .replace(/\n+$/, '')
    .split('\n')
    .filter(l => !REGION_MARKER.test(l))
    .join('\n')
}

const problems: string[] = []
const stale: string[] = []

// Ratchet: the guides still carry hand-written TS/JS fences that predate this
// script, and nothing stops a new one being added. Counting the un-included
// ones and failing when the total *rises* freezes that debt without demanding a
// big-bang conversion — the number only ever goes down, one guide at a time.
// A count works here, unlike the spec-recipe ratchet that became a tracked list
// of field names: an un-included fence has no stable identity to list, so there
// is nothing to name in the diff beyond the file it sits in.
//
// Only TS/JS fences count: a `json` config sample or a `bash` command has no
// compiled source to point an include at.
const FENCE_BASELINE = Number(process.env.DOC_FENCE_BASELINE ?? '117')
const INCLUDABLE = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'typescript',
  'javascript',
])
let unIncluded = 0

for (const path of walkFiles(docsDir, n => n.endsWith('.md'))) {
  const text = readFileSync(path, 'utf8')
  const lines = text.split('\n')
  const out: string[] = []
  let changed = false

  if (path.startsWith(guidesDir)) {
    let inFence = false
    lines.forEach((line, i) => {
      const fence = /^\s*```(\S*)/.exec(line)
      if (!fence) {
        return
      }
      if (inFence) {
        inFence = false
        return
      }
      inFence = true
      // The marker sits one or two lines up (prettier inserts a blank line).
      const marked = [1, 2].some(k => MARKER.test((lines[i - k] ?? '').trim()))
      if (!marked && INCLUDABLE.has(fence[1]!.toLowerCase())) {
        unIncluded++
      }
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const marker = MARKER.exec(lines[i]!.trim())
    out.push(lines[i]!)
    if (!marker) {
      continue
    }
    // prettier puts a blank line between the marker and the fence, so skip
    // blanks rather than silently ignoring the marker (which would leave a
    // stale fence passing --check — the exact drift this script prevents).
    let openAt = i + 1
    while (lines[openAt]?.trim() === '') {
      openAt++
    }
    if (!lines[openAt]?.startsWith('```')) {
      problems.push(
        `${path}: include marker for ${marker[1]} has no code fence`,
      )
      continue
    }
    const fenceOpen = lines[openAt]!
    const closeAt = lines.indexOf('```', openAt + 1)
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
    const current = lines.slice(openAt + 1, closeAt).join('\n')
    if (current !== body) {
      changed = true
    }
    out.push(
      ...lines.slice(i + 1, openAt),
      fenceOpen,
      ...body.split('\n'),
      '```',
    )
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

if (unIncluded > FENCE_BASELINE) {
  console.error(
    `\n${unIncluded} hand-written TS/JS fences in developer_guides exceeds the ` +
      `baseline of ${FENCE_BASELINE}. Point the new fence at real source with ` +
      `an <!-- include: --> marker (see example-plugins/score-example), or ` +
      `raise DOC_FENCE_BASELINE if it genuinely can't be.`,
  )
  process.exit(1)
} else if (unIncluded < FENCE_BASELINE) {
  console.log(
    `${unIncluded} hand-written TS/JS fences remain in developer_guides ` +
      `(baseline ${FENCE_BASELINE}) — lower DOC_FENCE_BASELINE to ${unIncluded} to hold the gain.`,
  )
}
