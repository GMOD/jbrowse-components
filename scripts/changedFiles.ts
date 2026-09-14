import { execFileSync } from 'node:child_process'

export function git(...args: string[]) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

export function lines(s: string) {
  return s
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
}

/**
 * Every path that differs between the merge base with `ref` and the working
 * tree — committed, uncommitted and untracked alike, deletions included.
 * Relative to the checkout root.
 */
export function changedFiles(ref: string) {
  const base = git('merge-base', ref, 'HEAD').trim()
  const files = [
    ...new Set([
      ...lines(git('diff', '--name-only', base)),
      ...lines(git('ls-files', '--others', '--exclude-standard')),
    ]),
  ]
  return { base, files }
}
