// One row per worktree under .claude/worktrees, with the three facts a removal
// decision needs and none of them trusted from memory: how far the branch is
// ahead of main, how many of those commits have no patch-equivalent on main
// (git cherry, so a branch replayed under new hashes reads as landed), how many
// files are dirty, and how long since the directory was last written. The
// verdict column is a suggestion; `git worktree remove` stays a human call.
//
// `--branches [days]` adds the same rows for local branches with no worktree
// that were committed to in the last N days (default 30), which is where
// abandoned work ends up once its worktree is gone.

import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function git(args: string[], cwd = root) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trimEnd()
}

interface Row {
  where: string
  branch: string
  ahead: number
  unlanded: number
  dirty: number | undefined
  hours: number
}

function branchFacts(branch: string) {
  const ahead = Number(git(['rev-list', '--count', `main..${branch}`]))
  const unlanded = ahead
    ? git(['cherry', 'main', branch])
        .split('\n')
        .filter(l => l.startsWith('+')).length
    : 0
  return { ahead, unlanded }
}

function hoursSince(epochSeconds: number) {
  return Math.round((Date.now() / 1000 - epochSeconds) / 360) / 10
}

function worktreeRows(): Row[] {
  const rows: Row[] = []
  let path = ''
  let branch = ''
  for (const line of git(['worktree', 'list', '--porcelain']).split('\n')) {
    if (line.startsWith('worktree ')) {
      path = line.slice('worktree '.length)
      branch = ''
    } else if (line.startsWith('branch ')) {
      branch = line.slice('branch refs/heads/'.length)
    } else if (line === 'detached') {
      branch = '(detached)'
    } else if (line === '' && path && path !== root) {
      rows.push(rowFor(path, branch))
    }
  }
  return rows
}

function rowFor(path: string, branch: string): Row {
  const ref = branch === '(detached)' ? 'HEAD' : branch
  const dirty = git(['status', '--porcelain'], path)
    .split('\n')
    .filter(Boolean).length
  return {
    where: relative(root, path),
    branch,
    ...branchFacts(
      branch === '(detached)' ? git(['rev-parse', 'HEAD'], path) : ref,
    ),
    dirty,
    hours: hoursSince(statSync(path).mtimeMs / 1000),
  }
}

function branchRows(days: number, withWorktree: Set<string>): Row[] {
  const since = Date.now() / 1000 - days * 86400
  return git([
    'for-each-ref',
    '--no-merged',
    'main',
    '--format=%(committerdate:unix) %(refname:short)',
    'refs/heads',
  ])
    .split('\n')
    .filter(Boolean)
    .map(l => l.split(' '))
    .filter(([date, name]) => Number(date) >= since && !withWorktree.has(name!))
    .map(([date, name]) => ({
      where: '',
      branch: name!,
      ...branchFacts(name!),
      dirty: undefined,
      hours: hoursSince(Number(date)),
    }))
}

function verdict(r: Row) {
  if (r.hours < 1) {
    return 'live'
  }
  if (r.dirty) {
    return 'dirty'
  }
  if (r.ahead === 0) {
    return 'landed'
  }
  if (r.unlanded === 0) {
    return 'replayed'
  }
  return 'work'
}

const branchesFlag = process.argv.indexOf('--branches')
const rows = worktreeRows()
if (branchesFlag !== -1) {
  const days = Number(process.argv[branchesFlag + 1]) || 30
  rows.push(...branchRows(days, new Set(rows.map(r => r.branch))))
}

const header = [
  'verdict',
  'ahead',
  'unlanded',
  'dirty',
  'hours',
  'branch',
  'worktree',
]
const table = rows
  .sort((a, b) => a.hours - b.hours)
  .map(r => [
    verdict(r),
    String(r.ahead),
    String(r.unlanded),
    r.dirty === undefined ? '-' : String(r.dirty),
    String(r.hours),
    r.branch,
    r.where,
  ])
const widths = header.map((h, i) =>
  Math.max(h.length, ...table.map(row => row[i]!.length)),
)
for (const row of [header, ...table]) {
  console.log(
    row
      .map((cell, i) => cell.padEnd(widths[i]!))
      .join('  ')
      .trimEnd(),
  )
}
console.log(
  '\nlanded: every commit is on main. replayed: every commit has a patch-equivalent on main under another hash. work: commits main lacks. Remove a worktree only when it is landed or replayed, clean, and hours cold.',
)
