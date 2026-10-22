/// <reference types="jest" />

/**
 * The build-age check's pure half. Both of its answers fail quietly if they are
 * wrong: a report nobody can act on is noise a figure run learns to scroll
 * past, and a silence over a stale build is the bug the whole check exists for
 * — the capture still succeeds, and the figure is just wrong.
 */
import {
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
    builtAt: '2026-10-20T05:45:00.000Z',
  },
  head: HEAD,
  commitInCheckout: true,
  behind: 0,
  commits: [],
  ahead: 0,
  uncommittedFiles: [],
  now,
  ...over,
})

const text = (report: { title: string; lines: string[] } | undefined) =>
  report ? [report.title, ...report.lines].join('\n') : undefined

test('a build holding every app change says nothing', () => {
  expect(stalenessReport(facts({ stamp: { commit: HEAD } }))).toBeUndefined()
})

test('commits that land outside the app leave the build current', () => {
  // docs-only work moves HEAD on; the bundle it would rebuild is identical
  expect(stalenessReport(facts({ behind: 9 }))).toBeUndefined()
})

test('a build behind the checkout names the gap, the commits and the rebuild', () => {
  const report = stalenessReport(
    facts({
      behind: 4,
      commits: [
        { hash: '7f3ab21', subject: 'Alignments sort takes field, not type' },
        { hash: '0a1b2c3', subject: 'Multi-row colors by score' },
      ],
    }),
  )
  expect(report?.title).toBe(
    'FIGURES CAPTURED AGAINST A STALE APP BUILD — products/jbrowse-web/build is 2 commits behind this checkout (built 2 days ago)',
  )
  expect(text(report)).toContain('built from a1cf6884ff (2026-10-20 01:38)')
  expect(text(report)).toContain('this checkout is at 7f3ab2190c, 4 commits on')
  expect(text(report)).toContain(
    '7f3ab21 Alignments sort takes field, not type',
  )
  expect(text(report)).toContain('pnpm --filter @jbrowse/web build')
})

test('a long gap lists the first commits and counts the rest', () => {
  const commits = Array.from({ length: 20 }, (_, i) => ({
    hash: `c${i}`,
    subject: `change ${i}`,
  }))
  const lines = stalenessReport(facts({ behind: 20, commits }))!.lines
  expect(lines.filter(l => l.includes('change '))).toHaveLength(12)
  expect(lines).toContain('    … and 8 more')
})

test('an app file edited after the build was written is reported alone', () => {
  const report = stalenessReport(
    facts({ uncommittedFiles: ['plugins/alignments/src/sort.ts'] }),
  )
  expect(report?.title).toContain(
    'predates 1 uncommitted app edit (built 2 days ago)',
  )
  expect(text(report)).toContain('1 app file edited since the build')
  expect(text(report)).toContain('    plugins/alignments/src/sort.ts')
})

test('a build carrying commits the checkout lacks is reported too', () => {
  expect(text(stalenessReport(facts({ ahead: 3 })))).toContain(
    'holds 3 app commits this checkout does not',
  )
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

test('a commit this checkout never had is its own report', () => {
  const report = stalenessReport(facts({ commitInCheckout: false }))
  expect(report?.title).toContain(
    'APP BUILT FROM A COMMIT THIS CHECKOUT DOES NOT HAVE',
  )
  expect(text(report)).toContain('is not in it')
})

test('git silence is not a verdict', () => {
  expect(stalenessReport(facts({ head: undefined }))).toBeUndefined()
})

test('a stamp parses, and anything else reads as no stamp', () => {
  expect(
    parseBuildStamp(
      '{"version":"5.0.0","commit":"abc","builtAt":"2026-10-20"}',
    ),
  ).toStrictEqual({
    version: '5.0.0',
    commit: 'abc',
    commitDate: undefined,
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
