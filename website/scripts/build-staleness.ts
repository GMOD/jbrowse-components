// Was the app these figures come from built from the source in this checkout?
// `build/` is replaced in place, so nothing on disk tells last week's build
// from this minute's. An old build rejects a session written against current
// source, or worse, accepts it and draws a wrong figure.
//
// `collectStalenessFacts` shells out to git and the network; everything else
// is a function of its arguments, so the report's wording and its silences are
// testable. Nothing here imports screenshot-options.ts, which parses
// process.argv when it loads.
import { readFileSync, realpathSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  APP_PATHS,
  git,
  workingTreeSnapshot,
} from '../../products/jbrowse-web/scripts/sourceSnapshot.ts'

// `build/build-info.json`, from products/jbrowse-web/scripts/writeBuildStamp.ts.
// Every field is optional: git is absent in a tarball build, and an older build
// has no file at all.
export interface BuildStamp {
  version?: string
  commit?: string
  commitDate?: string
  // the app sources on disk when the compile started, as a git tree id
  tree?: string
  builtAt?: string
  // a dev server compiles the working tree of `repoRoot` on every request
  dev?: boolean
  repoRoot?: string
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
  repoRoot?: string
  // absent when git could not answer, which leaves the gap unjudgeable
  head?: string
  // false when this checkout does not have the tree the build was made from
  snapshotInCheckout?: boolean
  // app files whose content differs between the build and the working tree
  changedFiles?: string[]
  // commits since the build's, touching those files
  commits?: StaleCommit[]
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
    tree: str(fields.tree),
    builtAt: str(fields.builtAt),
    ...(fields.dev === true
      ? { dev: true, repoRoot: str(fields.repoRoot) }
      : {}),
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
  return `• built from ${stamp.commit?.slice(0, 10)}${stamp.tree ? '' : ' with no snapshot of uncommitted edits'}${when ? ` (${when})` : ''}${old ? `, ${old} ago` : ''}`
}

/**
 * What to print before a run captures anything, or undefined when the build
 * holds exactly the app sources on disk. Silence is the common case: a
 * docs-only commit, a commit of the edits the build was made from, or a
 * fixture the capture server serves from the checkout moves nothing the build
 * owns.
 */
export function stalenessReport(
  facts: StalenessFacts,
): StalenessReport | undefined {
  const now = facts.now ?? new Date()
  const { source, stamp, head, repoRoot } = facts
  if (stamp?.dev) {
    return stamp.repoRoot && repoRoot && stamp.repoRoot !== repoRoot
      ? {
          title: `DEV SERVER FROM ANOTHER CHECKOUT — ${source} compiles ${stamp.repoRoot}, not ${repoRoot}`,
          lines: [
            '• its figures draw that checkout’s code',
            '• run `pnpm start` here, or point --port at this checkout’s server',
          ],
        }
      : undefined
  }
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
  if (facts.snapshotInCheckout === false) {
    return {
      title: `APP BUILT FROM SOURCE THIS CHECKOUT DOES NOT HAVE — ${source} may draw anything`,
      lines: [
        builtLine(stamp, now),
        `• this checkout is at ${head.slice(0, 10)}, and has no record of what the build compiled: it came from another clone or machine`,
        `• rebuild: ${REBUILD}`,
      ],
    }
  }
  const changedFiles = facts.changedFiles ?? []
  if (changedFiles.length === 0) {
    return undefined
  }
  const commits = facts.commits ?? []
  const built = age(stamp.builtAt ?? stamp.commitDate, now)
  return {
    title: `FIGURES CAPTURED AGAINST A STALE APP BUILD — ${source} differs from this checkout in ${plural(changedFiles.length, 'app file')}${built ? ` (built ${built} ago)` : ''}`,
    lines: [
      builtLine(stamp, now),
      `• this checkout is at ${head.slice(0, 10)}`,
      '• app files on disk that differ from what the build compiled:',
      ...listed(changedFiles, MAX_FILES),
      ...(commits.length > 0
        ? [
            '• commits since the build touching them:',
            ...listed(
              commits.map(c => `${c.hash} ${c.subject}`),
              MAX_COMMITS,
            ),
          ]
        : []),
      `• rebuild: ${REBUILD}`,
    ],
  }
}

// ---------------------------------------------------------------------------
// git and the build on disk
// ---------------------------------------------------------------------------

function gitLines(out: string | undefined) {
  return out
    ? out
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
    : []
}

function realpath(path: string) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
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
      missing: `--port ${externalPort} proxies to a server this run did not start. A \`pnpm start\` dev server says so in its ${STAMP_FILE}; a built app served from anywhere else can be any age, and this one serves no ${STAMP_FILE} to say`,
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

export async function collectStalenessFacts(
  inputs: StalenessInputs,
): Promise<StalenessFacts> {
  const repoRoot = realpath(inputs.repoRoot)
  const read = await readStamp(inputs)
  const { source, missing } = read
  const stamp = read.stamp?.repoRoot
    ? { ...read.stamp, repoRoot: realpath(read.stamp.repoRoot) }
    : read.stamp
  const head = git(['rev-parse', 'HEAD'], repoRoot)
  const commit = stamp?.commit
  const base = { source, stamp, missing, repoRoot, head }
  if (stamp?.dev || commit === undefined || head === undefined) {
    return base
  }
  // a build stamped before snapshots existed compiled its commit, plus
  // whatever was uncommitted then
  const built = stamp.tree ?? `${commit}:`
  if (git(['cat-file', '-t', built], repoRoot) !== 'tree') {
    return { ...base, snapshotInCheckout: false }
  }
  const onDisk = workingTreeSnapshot(repoRoot)
  if (onDisk === undefined) {
    return base
  }
  const changedFiles = gitLines(
    git(['diff', '--name-only', built, onDisk, '--', ...APP_PATHS], repoRoot),
  )
  return {
    ...base,
    snapshotInCheckout: true,
    changedFiles,
    commits:
      changedFiles.length > 0 &&
      git(['cat-file', '-t', commit], repoRoot) === 'commit'
        ? gitLines(
            git(
              [
                '--literal-pathspecs',
                'log',
                '--format=%h %s',
                `${commit}..HEAD`,
                '--',
                ...changedFiles,
              ],
              repoRoot,
            ),
          ).map(line => ({
            hash: line.slice(0, line.indexOf(' ')),
            subject: line.slice(line.indexOf(' ') + 1),
          }))
        : [],
  }
}
