// How fast the v5 config surface still moves: per day, the slot paths the
// committed config schema gained and lost. LinearMarkDisplay's paths count
// apart, since that display keeps evolving while the shared vocabulary settles
// (agent-docs/handoffs/v5-api-convergence.md). A slot retired with a lift keeps
// its path, so a respell shows as an add alone.
//
//   node scripts/settling-meter.ts [--days 30] [--list 2026-10-26]
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

import { slotPaths } from './configSlotPaths.ts'

const root = join(import.meta.dirname, '..')
const schemaFile = 'website/static/schema/v5/config.json'
const MARK_DISPLAY = 'LinearMarkDisplay'

const arg = (name: string) => {
  const at = process.argv.indexOf(name)
  return at === -1 ? undefined : process.argv[at + 1]
}
const days = Number(arg('--days') ?? 30)
const listDay = arg('--list')
const since = new Date(Date.now() - days * 86_400_000)
  .toISOString()
  .slice(0, 10)

const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })

const pathsAt = (rev: string) =>
  new Set(slotPaths(JSON.parse(git('show', `${rev}:${schemaFile}`))))

const isMarkDisplay = (path: string) =>
  path.split(/[.<[{=]/)[0] === MARK_DISPLAY

interface Day {
  commits: number
  added: string[]
  removed: string[]
}

const base = git(
  'log',
  '-1',
  '--format=%H',
  `--before=${since}`,
  '--',
  schemaFile,
).trim()
const commits = git(
  'log',
  '--reverse',
  '--format=%H %cd',
  '--date=short',
  `--since=${since}`,
  '--',
  schemaFile,
)
  .split('\n')
  .filter(Boolean)
  .map(line => line.split(' ') as [string, string])

const byDay = new Map<string, Day>()
const start = pathsAt(base)
let previous = start
for (const [sha, date] of commits) {
  const current = pathsAt(sha)
  const day = byDay.get(date) ?? { commits: 0, added: [], removed: [] }
  day.commits += 1
  day.added.push(...[...current].filter(path => !previous.has(path)))
  day.removed.push(...[...previous].filter(path => !current.has(path)))
  byDay.set(date, day)
  previous = current
}

if (listDay) {
  const day = byDay.get(listDay)
  for (const path of day?.added ?? []) {
    console.log(`+ ${path}`)
  }
  for (const path of day?.removed ?? []) {
    console.log(`- ${path}`)
  }
  process.exit(0)
}

const split = (paths: string[]) => {
  const mark = paths.filter(isMarkDisplay).length
  return [paths.length - mark, mark] as const
}
const cell = (value: number) => String(value).padStart(7)

console.log(`${'day'.padEnd(10)}  commits  shared+  shared-    mark+    mark-`)
for (const [date, day] of byDay) {
  const [sharedAdded, markAdded] = split(day.added)
  const [sharedRemoved, markRemoved] = split(day.removed)
  console.log(
    `${date}  ${cell(day.commits)}  ${cell(sharedAdded)}  ${cell(sharedRemoved)}  ${cell(markAdded)}  ${cell(markRemoved)}`,
  )
}
const [netSharedAdded, netMarkAdded] = split(
  [...previous].filter(path => !start.has(path)),
)
const [netSharedRemoved, netMarkRemoved] = split(
  [...start].filter(path => !previous.has(path)),
)
console.log(
  `${'net'.padEnd(10)}  ${cell(commits.length)}  ${cell(netSharedAdded)}  ${cell(netSharedRemoved)}  ${cell(netMarkAdded)}  ${cell(netMarkRemoved)}`,
)
console.log(`\n${previous.size} slot paths today`)
