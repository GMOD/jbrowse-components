// Fails on any built page with an <svg>, or an <img> of an .svg file, that has
// no width in its markup. A width with the viewBox fixes the height too.
//
// An SVG with only a viewBox fills its container until a stylesheet sizes it.
// When the CSS arrives late or not at all (stale cached HTML after a deploy
// removes the old hashed stylesheet), the nav logo drew at 1264x1313px.
// A width attribute makes the box right with no CSS; the CSS still overrides it.
//
// Operates on dist/ (run `pnpm build` first). Run: `pnpm check-unsized-svgs`,
// or pass a directory to scan somewhere else.
import { readFileSync } from 'node:fs'

import { assertDirExists, reportProblems, walkFiles } from './check-utils.ts'
import { distDir as defaultDistDir } from './paths.ts'

const distDir = process.argv[2] ?? defaultDistDir

const SVG_TAG = /<svg\b[^>]*>/g
const SVG_IMG = /<img\b[^>]*\ssrc="[^"]*\.svg(?:\?[^"]*)?"[^>]*>/g

function hasSize(tag: string) {
  return /\swidth=/.test(tag)
}

function unsizedTags(html: string) {
  return [...html.matchAll(SVG_TAG), ...html.matchAll(SVG_IMG)]
    .map(m => m[0])
    .filter(tag => !hasSize(tag))
}

assertDirExists(
  distDir,
  distDir === defaultDistDir ? 'run `pnpm build` first.' : undefined,
)

const problems = new Map<string, string[]>()
let checked = 0
for (const file of walkFiles(distDir, n => n.endsWith('.html'))) {
  checked++
  for (const tag of unsizedTags(readFileSync(file, 'utf8'))) {
    const shape = tag
      .replaceAll(/\sdata-astro-cid-[\w-]+(="true")?/g, '')
      .slice(0, 120)
    problems.set(shape, [
      ...(problems.get(shape) ?? []),
      file.slice(distDir.length + 1),
    ])
  }
}

const errorLines = [...problems].flatMap(([shape, files]) => [
  `  ${shape}`,
  `    → no width; on ${files.length} page(s), e.g. ${files[0]}`,
  '',
])
if (errorLines.length) {
  errorLines.unshift('Found <svg>/<img src=*.svg> without a width attribute:\n')
  errorLines.push(
    'Add width (and height) to the markup (CSS can still resize it).',
  )
}
reportProblems(errorLines, `ok: ${checked} pages, every SVG carries a size`)
