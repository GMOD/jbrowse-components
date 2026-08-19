// Renders the weekly lines-of-code chart the release announcement opens its
// "By the numbers" section with.
//
//   node website/scripts/generate-loc-chart.ts          re-render
//   node website/scripts/generate-loc-chart.ts --check   fail if it moved
//
// **Why this exists.** The committed PNG arrived as bytes beside the draft with
// no generator anywhere: its caption named tokei and a week span without
// recording the invocation, so it was the one figure in the post the release
// process could not re-derive. Every other one is a screenshot spec or a
// jbrowse-img recipe. A chart nobody can re-run is a claim about the codebase
// that ages without saying so, and this one is load-bearing — a paragraph in the
// announcement reads its shape.
//
// **Not in `pnpm autogen`, deliberately.** Its last point moves with every
// commit, so a --check on every push would fail on every push, which is the
// property that makes a gate worth ignoring. It is a release-day artifact like
// the diffstat `${DIFFSTAT}` placeholder, and PUBLISHING.md names both. `--check`
// is here for a deliberate run, not for CI.
//
// **What it counts** is what the caption says: non-test `.ts`/`.tsx` under
// `packages/`, `plugins/` and `products/`, at the last commit of each ISO week.
// Not tokei, which counts every language in the tree and would put the generated
// docs and the test corpus inside the same line. Blob line counts are memoized
// by sha, which is what makes ~400 weekly snapshots of a ~3,600-file tree
// tractable: consecutive weeks share nearly every blob.
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import sharp from 'sharp'

import { check } from './check-utils.ts'
import { repoRoot, websiteDir } from './paths.ts'

const OUT = join(websiteDir, 'static/img/blog/v5.0.0/loc_over_time.png')
const TREES = ['packages', 'plugins', 'products']
const WIDTH = 1650
const HEIGHT = 825

const git = (args: string[], input?: string) => {
  const { status, stdout, stderr } = spawnSync('git', args, {
    cwd: repoRoot,
    input,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
  if (status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`)
  }
  return stdout
}

const counted = /\.tsx?$/
const isSource = (path: string) =>
  counted.test(path) && !path.includes('.test.')

// One commit per ISO week: the last on first-parent, so a week is represented by
// what main actually held at the end of it rather than by a topic branch's tip.
//
// The commit's own date rides along because the x axis is TIME, not the index in
// this list. A week nobody committed in has no entry, and spacing the entries
// evenly would silently compress every stretch that has them — the quiet
// 2022-2024 middle is where that shows, and it moved a release marker most of a
// year from where the tag actually landed.
interface Week {
  week: string
  sha: string
  at: number
}
function weeklyCommits(): Week[] {
  const byWeek = new Map<string, Week>()
  for (const line of git([
    'log',
    '--first-parent',
    '--reverse',
    '--date=format:%G-W%V',
    '--format=%H %cd %ct',
    'HEAD',
  ]).split('\n')) {
    const [sha, week, seconds] = line.split(' ')
    if (sha && week && seconds) {
      byWeek.set(week, { week, sha, at: Number(seconds) })
    }
  }
  return [...byWeek.values()].sort((a, b) => a.at - b.at)
}

// `git cat-file --batch` over every blob whose count is not already known. One
// process for the whole run, so the cost is the bytes rather than the spawns.
//
// **A Buffer, not a string.** The `<size>` in each record's header is a byte
// count, and a decoded string is indexed in UTF-16 code units — so the first
// blob holding an em dash (this repo's prose is full of them) leaves every later
// offset short and the walk reads headers out of the middle of a file. It does
// not throw: it produced a series ending at 825,662 lines where the tree holds
// 473,114, with a single week appearing to add 383,615.
const lineCache = new Map<string, number>()
const NEWLINE = 0x0a
function countBlobs(shas: string[]) {
  const missing = [...new Set(shas)].filter(sha => !lineCache.has(sha))
  if (missing.length > 0) {
    const { status, stdout, stderr } = spawnSync(
      'git',
      ['cat-file', '--batch'],
      {
        cwd: repoRoot,
        input: `${missing.join('\n')}\n`,
        maxBuffer: 1024 * 1024 * 1024,
      },
    )
    if (status !== 0) {
      throw new Error(`git cat-file --batch failed: ${stderr}`)
    }
    let at = 0
    for (const sha of missing) {
      // <sha> blob <size>\n<contents>\n
      const nl = stdout.indexOf(NEWLINE, at)
      const size = Number(stdout.toString('utf8', at, nl).split(' ')[2])
      let lines = 0
      for (let i = nl + 1; i < nl + 1 + size; i++) {
        if (stdout[i] === NEWLINE) {
          lines++
        }
      }
      lineCache.set(sha, lines)
      at = nl + 1 + size + 1
    }
  }
  return shas.reduce((sum, sha) => sum + lineCache.get(sha)!, 0)
}

function locAt(sha: string) {
  const shas: string[] = []
  for (const line of git(['ls-tree', '-r', sha, '--', ...TREES]).split('\n')) {
    const [meta, path] = line.split('\t')
    if (path && isSource(path)) {
      shas.push(meta!.split(' ')[2]!)
    }
  }
  return countBlobs(shas)
}

const series = weeklyCommits().map(w => ({ ...w, loc: locAt(w.sha) }))

// A chart with no axis labels is a picture of a slope. The text is live rather
// than outlined: librsvg (behind sharp) ignores an embedded @font-face and falls
// back to whatever sans the host has, which for numerals and a title costs a few
// pixels of advance width — unlike the social card's wordmark, where the same
// fallback produces a wrong-looking logo. It does mean `--check` only means
// something on a machine with the same fonts, which is another reason this is
// not a CI gate.
const pad = { left: 150, right: 40, top: 110, bottom: 70 }
const plotW = WIDTH - pad.left - pad.right
const plotH = HEIGHT - pad.top - pad.bottom
const maxLoc = Math.max(...series.map(p => p.loc))
const step = 100_000
const ceiling = Math.ceil(maxLoc / step) * step
const first = series[0]!.at
const span = series.at(-1)!.at - first
const x = (at: number) => pad.left + ((at - first) / span) * plotW
const y = (loc: number) => pad.top + plotH - (loc / ceiling) * plotH

const esc = (t: string) => t.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
const font = 'font-family="Helvetica, Arial, sans-serif"'

// The release each dashed rule marks, at the week its tag landed. They are what
// turn a slope into a history: the last rule is where this release's window
// opens, and the announcement's prose points at what happens after it.
const MARKED = ['v2.0.0', 'v3.0.0', 'v4.0.0', 'v4.3.0']
const tagWeeks = git([
  'for-each-ref',
  '--sort=creatordate',
  '--format=%(refname:strip=2) %(creatordate:format:%s)',
  ...MARKED.map(t => `refs/tags/${t}`),
])
  .split('\n')
  .flatMap(line => {
    const [tag, at] = line.split(' ')
    return tag && at ? [{ tag, at: Number(at) }] : []
  })

const yTicks = Array.from({ length: ceiling / step + 1 }, (_, i) => i * step)
// New Year's Day of each year the series covers, on the same time axis as the
// line. The first is skipped: the series starts partway through 2018, so its
// label would sit outside the plot.
const years = Array.from(
  {
    length:
      new Date(series.at(-1)!.at * 1000).getUTCFullYear() -
      new Date(first * 1000).getUTCFullYear(),
  },
  (_, i) => new Date(first * 1000).getUTCFullYear() + 1 + i,
).map(year => ({ year, at: Date.UTC(year, 0, 1) / 1000 }))

const subtitle = `non-test .ts/.tsx under packages, plugins and products, one point per ISO week (${series.length} weeks, ${series[0]!.week.slice(0, 4)}–${series.at(-1)!.week.slice(0, 4)})`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
<text x="${pad.left - 20}" y="42" ${font} font-size="30" font-weight="bold" fill="#1a1a1a">JBrowse 2: lines of code, weekly</text>
<text x="${pad.left - 20}" y="80" ${font} font-size="22" fill="#333">${esc(subtitle)}</text>
<text x="42" y="${pad.top + plotH / 2}" ${font} font-size="22" fill="#333" text-anchor="middle" transform="rotate(-90 42 ${pad.top + plotH / 2})">Lines of code</text>
<g ${font} font-size="21" fill="#555">
${yTicks
  .map(
    t =>
      `<line x1="${pad.left}" y1="${y(t)}" x2="${WIDTH - pad.right}" y2="${y(t)}" stroke="#ececec" stroke-width="1"/>` +
      `<text x="${pad.left - 16}" y="${y(t) + 7}" text-anchor="end">${t.toLocaleString('en-US')}</text>`,
  )
  .join('\n')}
${years
  .map(
    ({ year, at }) =>
      `<text x="${x(at).toFixed(1)}" y="${pad.top + plotH + 34}" text-anchor="middle">${year}</text>`,
  )
  .join('\n')}
</g>
${tagWeeks
  .map(({ tag, at }) => {
    const px = x(at).toFixed(1)
    return (
      `<line x1="${px}" y1="${pad.top}" x2="${px}" y2="${pad.top + plotH}" stroke="#999" stroke-width="1.5" stroke-dasharray="7 6"/>` +
      `<text x="${px}" y="${pad.top + 14}" ${font} font-size="18" fill="#777" transform="rotate(90 ${px} ${pad.top + 14})">${tag}</text>`
    )
  })
  .join('\n')}
<polyline fill="none" stroke="#2b7bba" stroke-width="3.5" stroke-linejoin="round" points="${series
  .map(p => `${x(p.at).toFixed(1)},${y(p.loc).toFixed(1)}`)
  .join(' ')}"/>
<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="#666" stroke-width="1.5"/>
<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${WIDTH - pad.right}" y2="${pad.top + plotH}" stroke="#666" stroke-width="1.5"/>
</svg>`

const png = await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toBuffer()

// Reported rather than drawn. The announcement's prose beside this figure is
// about the shape and about the release window, and both are checkable here
// without opening the PNG — which is the whole complaint that produced this
// script.
const biggest = series.reduce(
  (best, p, i) =>
    i > 0 && p.loc - series[i - 1]!.loc > best.gain
      ? { week: p.week, gain: p.loc - series[i - 1]!.loc }
      : best,
  { week: '', gain: 0 },
)
const trend = series.every((p, i) => i === 0 || p.loc >= series[i - 1]!.loc)
  ? 'never fell week to week'
  : 'fell in at least one week'
console.log(
  `${series.length} weeks, ${series[0]!.week} to ${series.at(-1)!.week}, ` +
    `${series[0]!.loc.toLocaleString('en-US')} to ${maxLoc.toLocaleString('en-US')} lines\n` +
    `biggest weekly gain ${biggest.gain.toLocaleString('en-US')} in ${biggest.week}; ${trend}`,
)

if (check) {
  const { readFileSync } = await import('node:fs')
  if (!readFileSync(OUT).equals(png)) {
    console.error(
      `${OUT} differs from a fresh render — run \`pnpm loc-chart\`, then \`pnpm figures:push --filter loc_over_time\``,
    )
    process.exit(1)
  }
  console.log('loc chart is up to date')
} else {
  writeFileSync(OUT, png)
  console.log(`wrote ${OUT}`)
}
