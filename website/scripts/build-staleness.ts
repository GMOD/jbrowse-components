// Was the app these figures come from built from the source in this checkout?
//
// Nothing in a PNG says how old the app was, and `build/` is replaced in place,
// so a build from last week looks exactly like one from this minute. Both ways
// that bites are real. A session written against current source gets REJECTED
// by a build whose config schema predates it: a build from 2026-10-20 threw
// "AlignmentsSort takes type, pos, refName, tag and within, not field" at a
// session using the renamed `sort` key, and the run reported it only as an
// on-screen error. The quieter version is the dangerous one, where the old app
// accepts the session and draws a figure that is simply wrong.
//
// The split in this file is deliberate: `collectStalenessFacts` shells out to
// git and the network, everything else is a function of its arguments, so the
// report's wording and its silences are testable. Nothing here imports
// screenshot-options.ts, which parses process.argv when it loads.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// `build/build-info.json`, written by
// products/jbrowse-web/scripts/writeBuildStamp.ts. Every field is optional:
// git is absent in a tarball build, and a build made before the stamp existed
// has no file at all.
export interface BuildStamp {
  version?: string
  commit?: string
  commitDate?: string
  builtAt?: string
}

export interface StaleCommit {
  hash: string
  subject: string
}

export interface StalenessFacts {
  // the app this run captures against, in the words the report uses
  source: string
  stamp?: BuildStamp
  // what to say about a build that carries no commit, when the source alone
  // does not explain it
  missing?: string
  // the checkout's HEAD; absent when git could not answer, which leaves the
  // gap unjudgeable
  head?: string
  // false when this checkout does not have the commit the build names
  commitInCheckout?: boolean
  // every commit HEAD has and the build lacks, whether or not it touches the app
  behind?: number
  // of those, the ones touching what the app is built from
  commits?: StaleCommit[]
  // app commits the build has and this checkout does not, after a reset or a
  // rebase under a finished build
  ahead?: number
  // app files edited since the build was written, uncommitted
  uncommittedFiles?: string[]
  now?: Date
}

export interface StalenessReport {
  title: string
  lines: string[]
}

const REBUILD = 'pnpm --filter @jbrowse/web build'
const STAMP_FILE = 'build-info.json'
const MAX_COMMITS = 12
const MAX_FILES = 8

/**
 * Read `build-info.json`'s text. Anything that is not an object with a field
 * this module knows reads as no stamp: a dev server answers an unknown path
 * with index.html, and a build killed mid-write leaves half a file.
 */
export function parseBuildStamp(text: string | undefined) {
  if (!text) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined
  }
  const fields = parsed as Record<string, unknown>
  const str = (v: unknown) =>
    typeof v === 'string' && v !== '' ? v : undefined
  const stamp: BuildStamp = {
    version: str(fields.version),
    commit: str(fields.commit),
    commitDate: str(fields.commitDate),
    builtAt: str(fields.builtAt),
  }
  return Object.values(stamp).some(v => v !== undefined) ? stamp : undefined
}

// Minutes, in the committer's own offset, the way `git log` prints a date.
// Not toLocaleString, whose output moves with the machine running the sweep.
function stampTime(iso: string | undefined) {
  return iso && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(iso)
    ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}`
    : iso
}

function age(iso: string | undefined, now: Date) {
  const then = iso === undefined ? Number.NaN : Date.parse(iso)
  if (Number.isNaN(then)) {
    return undefined
  }
  const minutes = Math.max(0, Math.round((now.getTime() - then) / 60000))
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function listed(items: string[], max: number, indent = '    ') {
  const shown = items.slice(0, max).map(item => `${indent}${item}`)
  return items.length > max
    ? [...shown, `${indent}… and ${items.length - max} more`]
    : shown
}

function builtLine(stamp: BuildStamp, now: Date) {
  const when = stampTime(stamp.commitDate)
  const old = age(stamp.builtAt ?? stamp.commitDate, now)
  return `• built from ${stamp.commit?.slice(0, 10)}${when ? ` (${when})` : ''}${old ? `, ${old} ago` : ''}`
}

/**
 * What to print before a run captures anything, or undefined when the build
 * holds every app change in the checkout. Silence is the common case and has
 * to stay cheap: a docs-only commit, or a fixture edit the capture server
 * serves from the checkout anyway, moves nothing the build owns.
 */
export function stalenessReport(
  facts: StalenessFacts,
): StalenessReport | undefined {
  const now = facts.now ?? new Date()
  const { source, stamp, head } = facts
  if (stamp?.commit === undefined) {
    return {
      title: `NO BUILD PROVENANCE — ${source} does not record the commit it was built from, so this run cannot tell a current app from a stale one`,
      lines: [
        ...(facts.missing ? [`• ${facts.missing}`] : []),
        ...(stamp?.builtAt
          ? [`• it was built ${age(stamp.builtAt, now) ?? 'some time'} ago`]
          : []),
        `• a build stamps itself: ${REBUILD}`,
      ],
    }
  }
  if (head === undefined) {
    return undefined
  }
  if (facts.commitInCheckout === false) {
    return {
      title: `APP BUILT FROM A COMMIT THIS CHECKOUT DOES NOT HAVE — ${source} may draw anything`,
      lines: [
        builtLine(stamp, now),
        `• this checkout is at ${head.slice(0, 10)}, and ${stamp.commit.slice(0, 10)} is not in it: the build came from another branch or another machine`,
        `• rebuild: ${REBUILD}`,
      ],
    }
  }
  const commits = facts.commits ?? []
  const uncommittedFiles = facts.uncommittedFiles ?? []
  const ahead = facts.ahead ?? 0
  if (commits.length === 0 && uncommittedFiles.length === 0 && ahead === 0) {
    return undefined
  }
  const built = age(stamp.builtAt ?? stamp.commitDate, now)
  const gap =
    commits.length > 0
      ? `is ${plural(commits.length, 'commit')} behind this checkout${uncommittedFiles.length > 0 ? ', and misses uncommitted edits' : ''}`
      : uncommittedFiles.length > 0
        ? `predates ${plural(uncommittedFiles.length, 'uncommitted app edit')}`
        : 'holds app commits this checkout does not'
  return {
    title: `FIGURES CAPTURED AGAINST A STALE APP BUILD — ${source} ${gap}${built ? ` (built ${built} ago)` : ''}`,
    lines: [
      builtLine(stamp, now),
      `• this checkout is at ${head.slice(0, 10)}${facts.behind ? `, ${plural(facts.behind, 'commit')} on from the build` : ''}`,
      ...(commits.length > 0
        ? [
            `• ${plural(commits.length, 'commit')} since, touching what the app is built from:`,
            ...listed(
              commits.map(c => `${c.hash} ${c.subject}`),
              MAX_COMMITS,
            ),
          ]
        : []),
      ...(uncommittedFiles.length > 0
        ? [
            `• ${plural(uncommittedFiles.length, 'app file')} edited since the build was written:`,
            ...listed(uncommittedFiles, MAX_FILES),
          ]
        : []),
      ...(ahead > 0
        ? [
            `• the build also holds ${plural(ahead, 'app commit')} this checkout does not, so it can draw code that is not in the tree`,
          ]
        : []),
      '• an old build rejects a session the current source accepts, and worse, accepts one it should reject and draws it wrong',
      `• rebuild: ${REBUILD}`,
    ],
  }
}

// ---------------------------------------------------------------------------
// git and the build on disk
// ---------------------------------------------------------------------------

// What the app bundle is built from. Over-inclusive by design: a package
// outside @jbrowse/web's dependency closure counts here, and all that costs is
// a warning over a change that could not have moved a figure. test_data is
// excluded because the capture server serves it from the CHECKOUT rather than
// from `build/`, so a new fixture needs no rebuild and must not warn.
const APP_PATHS = [
  'packages',
  'plugins',
  'products/jbrowse-web',
  'config',
  'pnpm-lock.yaml',
  ':(exclude)products/jbrowse-web/test_data',
]

function git(repoRoot: string, args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return undefined
  }
}

function gitLines(out: string | undefined) {
  return out
    ? out
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
    : []
}

function count(out: string | undefined) {
  const n = Number(out)
  return out !== undefined && Number.isFinite(n) ? n : undefined
}

export interface StalenessInputs {
  // products/jbrowse-web/build
  buildPath: string
  repoRoot: string
  // --port: the run proxies to a server it did not start
  externalPort?: number
}

async function readStamp({
  buildPath,
  repoRoot,
  externalPort,
}: StalenessInputs) {
  if (externalPort !== undefined) {
    const text = await fetch(`http://localhost:${externalPort}/${STAMP_FILE}`, {
      signal: AbortSignal.timeout(5000),
    })
      .then(res => (res.ok ? res.text() : undefined))
      .catch(() => undefined)
    return {
      source: `the app on port ${externalPort}`,
      stamp: parseBuildStamp(text),
      missing: `--port ${externalPort} proxies to a server this run did not start. A \`pnpm start\` dev server serves the current source and is never stale; a built app served from anywhere else can be any age, and this one serves no ${STAMP_FILE} to say`,
    }
  }
  let text: string | undefined
  try {
    text = readFileSync(join(buildPath, STAMP_FILE), 'utf8')
  } catch {
    text = undefined
  }
  // the absolute path when the build sits outside the tree git is answering
  // for, where `../../../products/…` would read as this checkout's own build
  const rel = relative(repoRoot, buildPath)
  return {
    source: rel && !rel.startsWith('..') ? rel : buildPath,
    stamp: parseBuildStamp(text),
    missing: 'the build predates this check, or came from a release tarball',
  }
}

// An edit older than the build is already in it, which is every file still
// uncommitted after the rebuild that captured it — the normal way to work, and
// it must stay silent. A file git names but stat cannot reach was deleted, so
// it counts as newer.
function editedAfter(repoRoot: string, file: string, builtAt: number) {
  if (Number.isNaN(builtAt)) {
    return true
  }
  try {
    return statSync(join(repoRoot, file)).mtimeMs > builtAt
  } catch {
    return true
  }
}

export async function collectStalenessFacts(
  inputs: StalenessInputs,
): Promise<StalenessFacts> {
  const { repoRoot } = inputs
  const { source, stamp, missing } = await readStamp(inputs)
  const head = git(repoRoot, ['rev-parse', 'HEAD'])
  const commit = stamp?.commit
  if (commit === undefined || head === undefined) {
    return { source, stamp, missing, head }
  }
  // `cat-file -t` exits non-zero on a commit this checkout never fetched,
  // which git() turns into undefined
  if (git(repoRoot, ['cat-file', '-t', commit]) !== 'commit') {
    return { source, stamp, head, commitInCheckout: false }
  }
  const builtAt = Date.parse(stamp?.builtAt ?? '')
  return {
    source,
    stamp,
    head,
    commitInCheckout: true,
    behind: count(git(repoRoot, ['rev-list', '--count', `${commit}..HEAD`])),
    commits: gitLines(
      git(repoRoot, [
        'log',
        '--format=%h %s',
        `${commit}..HEAD`,
        '--',
        ...APP_PATHS,
      ]),
    ).map(line => ({
      hash: line.slice(0, line.indexOf(' ')),
      subject: line.slice(line.indexOf(' ') + 1),
    })),
    ahead: count(
      git(repoRoot, [
        'rev-list',
        '--count',
        `HEAD..${commit}`,
        '--',
        ...APP_PATHS,
      ]),
    ),
    uncommittedFiles: gitLines(
      git(repoRoot, ['diff', '--name-only', 'HEAD', '--', ...APP_PATHS]),
    ).filter(file => editedAfter(repoRoot, file, builtAt)),
  }
}
