/// <reference types="jest" />

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { buildProvenance } from '../../products/jbrowse-web/scripts/sourceSnapshot.ts'
import {
  collectStalenessFacts,
  parseBuildStamp,
  stalenessReport,
  type StalenessFacts,
} from './build-staleness.ts'

const HEAD = '7f3ab2190c4e5d6a7b8c9d0e1f2a3b4c5d6e7f80'
const BUILT = 'a1cf6884ff1122334455667788990011aabbccdd'
const now = new Date('2026-10-22T12:00:00Z')

const facts = (over: Partial<StalenessFacts> = {}): StalenessFacts => ({
  source: 'products/jbrowse-web/build',
  stamp: {
    version: '5.0.0-beta.17',
    commit: BUILT,
    commitDate: '2026-10-20T01:38:12-04:00',
    tree: 'b'.repeat(40),
    builtAt: '2026-10-20T05:45:00.000Z',
  },
  head: HEAD,
  snapshotInCheckout: true,
  changedFiles: [],
  commits: [],
  now,
  ...over,
})

const text = (report: { title: string; lines: string[] } | undefined) =>
  report ? [report.title, ...report.lines].join('\n') : undefined

test('a build holding every app file on disk says nothing', () => {
  expect(stalenessReport(facts())).toBeUndefined()
})

test('a build that differs from the checkout names the files, the commits and the rebuild', () => {
  const report = stalenessReport(
    facts({
      changedFiles: ['plugins/alignments/src/sort.ts', 'packages/core/a.ts'],
      commits: [
        { hash: '7f3ab21', subject: 'Alignments sort takes field, not type' },
      ],
    }),
  )
  expect(report?.title).toBe(
    'FIGURES CAPTURED AGAINST A STALE APP BUILD — products/jbrowse-web/build differs from this checkout in 2 app files (built 2 days ago)',
  )
  expect(text(report)).toContain('built from a1cf6884ff (2026-10-20 01:38)')
  expect(text(report)).toContain('this checkout is at 7f3ab2190c')
  expect(text(report)).toContain('    plugins/alignments/src/sort.ts')
  expect(text(report)).toContain(
    '7f3ab21 Alignments sort takes field, not type',
  )
  expect(text(report)).toContain('pnpm --filter @jbrowse/web build')
})

test('a long list shows the first files and counts the rest', () => {
  const changedFiles = Array.from({ length: 20 }, (_, i) => `packages/f${i}`)
  const lines = stalenessReport(facts({ changedFiles }))!.lines
  expect(lines.filter(l => l.includes('packages/f'))).toHaveLength(8)
  expect(lines).toContain('    … and 12 more')
})

test('a build stamped without a snapshot says so', () => {
  const report = stalenessReport(
    facts({
      stamp: { commit: BUILT },
      changedFiles: ['packages/core/a.ts'],
    }),
  )
  expect(text(report)).toContain('with no snapshot of uncommitted edits')
})

test('a build with no stamp asks for a rebuild and repeats why', () => {
  const report = stalenessReport(
    facts({
      source: 'the app on port 9000',
      stamp: undefined,
      missing: '--port 9000 proxies to a server this run did not start',
    }),
  )
  expect(report?.title).toBe(
    'NO BUILD PROVENANCE — the app on port 9000 does not record the commit it was built from, so this run cannot tell a current app from a stale one',
  )
  expect(text(report)).toContain(
    '--port 9000 proxies to a server this run did not start',
  )
  expect(text(report)).toContain('pnpm --filter @jbrowse/web build')
})

test('a snapshot this checkout never had is its own report', () => {
  const report = stalenessReport(facts({ snapshotInCheckout: false }))
  expect(report?.title).toContain(
    'APP BUILT FROM SOURCE THIS CHECKOUT DOES NOT HAVE',
  )
})

test('git silence is not a verdict', () => {
  expect(stalenessReport(facts({ head: undefined }))).toBeUndefined()
})

test('a stamp parses, and anything else reads as no stamp', () => {
  expect(
    parseBuildStamp(
      '{"version":"5.0.0","commit":"abc","tree":"def","builtAt":"2026-10-20"}',
    ),
  ).toStrictEqual({
    version: '5.0.0',
    commit: 'abc',
    commitDate: undefined,
    tree: 'def',
    builtAt: '2026-10-20',
  })
  // what a dev server answers for an unknown path, and what a killed build left
  expect(parseBuildStamp('<!DOCTYPE html><html></html>')).toBeUndefined()
  expect(parseBuildStamp('{"version":"5.0.0"')).toBeUndefined()
  expect(parseBuildStamp('"5.0.0"')).toBeUndefined()
  expect(parseBuildStamp('{}')).toBeUndefined()
  expect(parseBuildStamp('')).toBeUndefined()
  expect(parseBuildStamp(undefined)).toBeUndefined()
})

test('a dev server compiling this checkout is never stale', () => {
  const dev = parseBuildStamp('{"dev":true,"repoRoot":"/src/jb"}')
  expect(dev).toEqual({ dev: true, repoRoot: '/src/jb' })
  expect(
    stalenessReport({
      source: 'the app on port 3000',
      stamp: dev,
      repoRoot: '/src/jb',
      head: HEAD,
      changedFiles: ['products/jbrowse-web/src/index.ts'],
    }),
  ).toBeUndefined()
  expect(
    stalenessReport({
      source: 'the app on port 3000',
      stamp: parseBuildStamp('{"dev":true}'),
      repoRoot: '/src/jb',
      head: HEAD,
    }),
  ).toBeUndefined()
  // a build that stamps nothing still reports, which is what tells the two apart
  expect(
    stalenessReport({
      source: 'the app on port 3000',
      stamp: undefined,
      head: HEAD,
    })?.title,
  ).toMatch(/NO BUILD PROVENANCE/)
})

test('a dev server compiling another checkout says which', () => {
  expect(
    stalenessReport({
      source: 'the app on port 3000',
      stamp: { dev: true, repoRoot: '/src/jb/.claude/worktrees/other' },
      repoRoot: '/src/jb',
      head: HEAD,
    })?.title,
  ).toBe(
    'DEV SERVER FROM ANOTHER CHECKOUT — the app on port 3000 compiles /src/jb/.claude/worktrees/other, not /src/jb',
  )
})

describe('against a real checkout', () => {
  let repo: string
  const saved = { ...process.env }

  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=t',
        '-c',
        'user.email=t@t',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        ...args,
      ],
      { cwd: repo, stdio: 'ignore' },
    )
  const write = (file: string, content: string) => {
    mkdirSync(dirname(join(repo, file)), { recursive: true })
    writeFileSync(join(repo, file), content)
  }
  const build = () => {
    write('build/build-info.json', JSON.stringify(buildProvenance(repo)))
  }
  const check = async () =>
    stalenessReport(
      await collectStalenessFacts({
        buildPath: join(repo, 'build'),
        repoRoot: repo,
      }),
    )

  beforeAll(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('GIT_')) {
        delete process.env[key]
      }
    }
  })
  afterAll(() => {
    process.env = saved
  })
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'build-staleness-'))
    git('init', '-q')
    write('.gitignore', '/build\n')
    write('packages/a.ts', 'one\n')
    write('plugins/b.ts', 'one\n')
    write('products/jbrowse-web/c.ts', 'one\n')
    write('config/d.ts', 'one\n')
    write('pnpm-lock.yaml', 'one\n')
    write('docs/e.md', 'one\n')
    git('add', '-A')
    git('commit', '-qm', 'init')
  })
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true })
  })

  test('a build of a clean tree is current', async () => {
    build()
    expect(await check()).toBeUndefined()
  })

  test('committing the edits a build compiled leaves it current', async () => {
    write('packages/a.ts', 'two\n')
    build()
    git('commit', '-qam', 'edit')
    expect(await check()).toBeUndefined()
  })

  test('discarding the edits a build compiled makes it stale', async () => {
    write('packages/a.ts', 'two\n')
    build()
    write('packages/a.ts', 'one\n')
    expect(text(await check())).toContain('    packages/a.ts')
  })

  test('an untracked file edited after the build makes it stale', async () => {
    write('plugins/new.ts', 'one\n')
    build()
    write('plugins/new.ts', 'two\n')
    expect(text(await check())).toContain('    plugins/new.ts')
  })

  test('a commit after the build is named', async () => {
    build()
    write('config/d.ts', 'two\n')
    git('commit', '-qam', 'Config grows')
    const report = text(await check())
    expect(report).toContain('    config/d.ts')
    expect(report).toMatch(/[0-9a-f]+ Config grows/)
  })

  test('an edit outside the app leaves the build current', async () => {
    build()
    write('docs/e.md', 'two\n')
    git('commit', '-qam', 'docs')
    write('docs/f.md', 'new\n')
    expect(await check()).toBeUndefined()
  })
})
