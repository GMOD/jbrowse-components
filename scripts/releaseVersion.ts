// Argument parsing and version arithmetic for the release scripts, kept
// separate so it is testable — each of them runs on import, so nothing in one
// can be imported. Throws rather than exiting; the callers turn that into a
// clean message.

const LEVELS = new Set(['patch', 'minor', 'major'])
const VERSION = /^\d+\.\d+\.\d+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$/

// Every flag a script accepts, so the ones it doesn't can be refused rather
// than ignored. Each of these scripts reads its flags with `includes`, which
// makes a typo mean "off" — and the flags anyone would mistype are the two that
// exist only to hold a run back: `pnpm release minor --dryrun` bumps, commits,
// tags and pushes a real release, and `pnpm announce -- --dryrun` posts to
// Bluesky, Mastodon and the newsletter for real. Same shape as parseTagArg's
// missing-value guard, and the same reason: silence is the wrong default when
// the mistake is one you cannot take back.
export function unknownFlags(argv: string[], known: string[]) {
  const valid = new Set(known)
  return argv.filter(a => a.startsWith('--') && !valid.has(a))
}

const RELEASE_FLAGS = ['--skip-ci-check', '--dry-run', '--version']

export function parseReleaseArgs(argv: string[]) {
  const versionIdx = argv.indexOf('--version')
  const explicitVersion = versionIdx === -1 ? undefined : argv[versionIdx + 1]
  // Rejected here rather than left to the VERSION test below, which would
  // report `--version --dry-run` as a malformed version number instead of as a
  // value the shell ate.
  if (
    versionIdx !== -1 &&
    (!explicitVersion || explicitVersion.startsWith('--'))
  ) {
    throw new Error('--version needs a value, e.g. --version 4.4.0-beta.1')
  }
  // After the guard above, so --version's own value is never mistaken for one.
  const unknown = unknownFlags(argv, RELEASE_FLAGS)
  if (unknown.length > 0) {
    throw new Error(
      `Unknown option ${unknown.join(', ')}. Valid options: ${RELEASE_FLAGS.join(', ')}`,
    )
  }
  const skipCiCheck = argv.includes('--skip-ci-check')
  const dryRun = argv.includes('--dry-run')
  if (explicitVersion && !VERSION.test(explicitVersion)) {
    throw new Error(
      `--version '${explicitVersion}' is not X.Y.Z or X.Y.Z-prerelease`,
    )
  }
  // Skip --version's own value, or `--version 4.4.0-beta.1` reads it as the
  // level. Guard on versionIdx !== -1: otherwise versionIdx + 1 is 0 and the
  // first positional is dropped, silently turning `release major` into a patch.
  const level =
    argv.find(
      (a, i) =>
        !a.startsWith('--') && (versionIdx === -1 || i !== versionIdx + 1),
    ) ?? 'patch'
  if (!LEVELS.has(level)) {
    throw new Error(
      `Invalid semver level '${level}'. Use patch, minor, or major.`,
    )
  }
  return { skipCiCheck, dryRun, explicitVersion, level }
}

export function nextVersion({
  previousVersion,
  level,
  explicitVersion,
}: {
  previousVersion: string
  level: string
  explicitVersion?: string
}) {
  if (explicitVersion) {
    return explicitVersion
  }
  // Number() on a prerelease part silently yields garbage ('5.0.0-beta.1'
  // patch -> 5.0.NaN), so the arithmetic path requires a plain X.Y.Z base.
  const parsed = /^(\d+)\.(\d+)\.(\d+)$/.exec(previousVersion)
  if (!parsed) {
    throw new Error(
      `Previous version '${previousVersion}' is not a plain X.Y.Z; pass --version to set the next one explicitly`,
    )
  }
  const maj = Number(parsed[1])
  const min = Number(parsed[2])
  const pat = Number(parsed[3])
  return level === 'major'
    ? `${maj + 1}.0.0`
    : level === 'minor'
      ? `${maj}.${min + 1}.0`
      : `${maj}.${min}.${pat + 1}`
}

export const isPrerelease = (version: string) => version.includes('-')

// `--tag v4.3.1` for releasenotes.ts and announce.ts, which both select a
// release post by it.
//
// A bare trailing `--tag` used to read as `undefined`, which is also how "no
// --tag at all" is spelled — and that means "the newest post". So a typo, or a
// shell that ate the value, silently re-announced the previous release to
// Bluesky, Mastodon and the newsletter instead of failing. Same class of bug as
// the versionIdx guard above, with a worse blast radius.
export function parseTagArg(argv: string[]) {
  const idx = argv.indexOf('--tag')
  if (idx === -1) {
    return undefined
  }
  const value = argv[idx + 1]
  if (!value || value.startsWith('--')) {
    throw new Error('--tag needs a value, e.g. --tag v4.3.1')
  }
  return value
}
