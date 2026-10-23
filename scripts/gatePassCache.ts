// Remembers which verify gates passed on which exact tree, so a rerun on a tree
// nothing has touched since (a commit, `verify` then `verify --full`, a rebase
// that brought nothing) skips them. 97 of 486 agent gate runs in the four days
// to 2026-10-23 were such reruns, 2.6h of waiting.
//
// The key is the working tree as `git add -A` would commit it, the installed
// node_modules, and the gate's argv, which carries the changed-file scope. An
// untracked file over 4MB goes in by path, size and mtime instead, since
// hashing a multi-GB data file would copy it into the object store. Only passes are stored,
// one empty file each under the shared git dir, with paths made relative so
// two worktrees on the same tree share them.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WEEK_MS = 7 * 24 * 3600 * 1000
const BIG = 4 * 1024 * 1024

function git(root: string, args: string[], env?: NodeJS.ProcessEnv) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : undefined,
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}

function stamp(path: string) {
  const s = statSync(path, { bigint: true, throwIfNoEntry: false })
  return s ? `${s.size}:${s.mtimeNs}` : '-'
}

function treeKey(root: string) {
  const tmp = mkdtempSync(join(tmpdir(), 'verify-index-'))
  try {
    const index = join(tmp, 'index')
    copyFileSync(
      git(root, ['rev-parse', '--path-format=absolute', '--git-path', 'index']),
      index,
    )
    const env = { GIT_INDEX_FILE: index }
    git(root, ['add', '-u'], env)
    const untracked = git(root, ['ls-files', '-z', '-o', '--exclude-standard'])
      .split('\0')
      .filter(Boolean)
    const big = untracked.filter(
      f =>
        (statSync(join(root, f), { throwIfNoEntry: false })?.size ?? 0) > BIG,
    )
    const small = untracked.filter(f => !big.includes(f))
    if (small.length > 0) {
      execFileSync(
        'git',
        ['add', '--pathspec-from-file=-', '--pathspec-file-nul'],
        {
          cwd: root,
          env: { ...process.env, ...env },
          input: small.join('\0'),
        },
      )
    }
    return [
      git(root, ['write-tree'], env),
      stamp(join(root, 'node_modules/.modules.yaml')),
      ...big.map(f => `${f}\0${stamp(join(root, f))}`),
    ].join('\n')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function sweep(dir: string) {
  const now = Date.now()
  for (const f of readdirSync(dir)) {
    if (now - statSync(join(dir, f)).mtimeMs > WEEK_MS) {
      rmSync(join(dir, f), { force: true })
    }
  }
}

function open(root: string) {
  try {
    const dir = join(
      git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
      'verify-passes',
    )
    mkdirSync(dir, { recursive: true })
    sweep(dir)
    return { dir, tree: treeKey(root) }
  } catch (e) {
    console.warn(`verify: no pass cache this run (${e})`)
    return undefined
  }
}

export function gatePassCache(root: string, enabled: boolean) {
  const cache = enabled ? open(root) : undefined
  const file = (argv: string[]) =>
    cache
      ? join(
          cache.dir,
          createHash('sha256')
            .update(cache.tree)
            .update('\0\0')
            // sorted, since staging a file can reorder the changed-file list
            .update(
              argv
                .map(a => a.replaceAll(root, '.'))
                .sort()
                .join('\0'),
            )
            .digest('hex'),
        )
      : undefined
  const passes: string[] = []

  return {
    passed(argv: string[]) {
      const f = file(argv)
      return f !== undefined && existsSync(f)
    },
    record(argv: string[]) {
      const f = file(argv)
      if (f) {
        passes.push(f)
      }
    },
    // A pass counts only for the tree it ran on, so nothing is stored when the
    // tree moved during the run.
    save() {
      if (cache && passes.length > 0 && treeKey(root) === cache.tree) {
        for (const f of passes) {
          writeFileSync(f, '')
        }
      }
    },
  }
}
