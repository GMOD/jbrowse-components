import {
  isPrerelease,
  nextVersion,
  parseReleaseArgs,
  parseTagArg,
  unknownFlags,
} from './releaseVersion.ts'

const from = (argv: string[], previousVersion = '4.3.0') => {
  const { level, explicitVersion } = parseReleaseArgs(argv)
  return nextVersion({ previousVersion, level, explicitVersion })
}

test('semver levels', () => {
  expect(from([])).toBe('4.3.1')
  expect(from(['patch'])).toBe('4.3.1')
  expect(from(['minor'])).toBe('4.4.0')
  // regression: versionIdx + 1 is 0 when --version is absent, which dropped the
  // first positional and silently turned `release major` into a patch
  expect(from(['major'])).toBe('5.0.0')
  expect(from(['major', '--skip-ci-check'])).toBe('5.0.0')
  expect(from(['--skip-ci-check', 'major'])).toBe('5.0.0')
})

test('--version overrides the arithmetic and allows prereleases', () => {
  expect(from(['--version', '4.4.0-beta.1'])).toBe('4.4.0-beta.1')
  expect(from(['--version', '5.0.0'])).toBe('5.0.0')
  // the value must not be mistaken for the semver level
  expect(parseReleaseArgs(['--version', '4.4.0-beta.1']).level).toBe('patch')
  // cutting from a prerelease base needs an explicit target
  expect(from(['--version', '4.4.0'], '4.4.0-beta.1')).toBe('4.4.0')
})

// The v5 beta sequence: cut a major beta off 4.3.0, iterate, then go stable.
// Every step after the first needs --version, because the arithmetic path
// refuses a prerelease base.
test('major beta sequence', () => {
  expect(from(['--version', '5.0.0-beta.1'])).toBe('5.0.0-beta.1')
  expect(isPrerelease(from(['--version', '5.0.0-beta.1']))).toBe(true)
  expect(from(['--version', '5.0.0-beta.2'], '5.0.0-beta.1')).toBe(
    '5.0.0-beta.2',
  )
  expect(from(['--version', '5.0.0'], '5.0.0-beta.2')).toBe('5.0.0')
  expect(isPrerelease(from(['--version', '5.0.0'], '5.0.0-beta.2'))).toBe(false)
  // and plain `release major` off 4.3.0 still lands on the same major
  expect(from(['major'])).toBe('5.0.0')
})

test('rejects bad input', () => {
  expect(() => parseReleaseArgs(['bogus'])).toThrow('Invalid semver level')
  expect(() => parseReleaseArgs(['--version'])).toThrow('needs a value')
  expect(() => parseReleaseArgs(['--version', '4.4'])).toThrow('is not X.Y.Z')
  // a value the shell ate is that, not a malformed version number
  expect(() => parseReleaseArgs(['--version', '--dry-run'])).toThrow(
    'needs a value',
  )
  expect(() =>
    nextVersion({ previousVersion: '4.4.0-beta.1', level: 'patch' }),
  ).toThrow('not a plain X.Y.Z')
})

// Both flags are read with `includes`, so an unrecognized one used to be
// ignored in silence — and the flag anyone mistypes is the one holding the run
// back: `--dryrun` would bump, commit, tag and push a real release, with no
// undo for that or for the announcement equivalent.
test('an unrecognized flag is refused, not ignored', () => {
  expect(() => parseReleaseArgs(['minor', '--dryrun'])).toThrow(
    'Unknown option --dryrun',
  )
  expect(() => parseReleaseArgs(['--skip-ci'])).toThrow('Unknown option')
  expect(() =>
    parseReleaseArgs(['--dry-run', '--nope', '--also-nope']),
  ).toThrow('Unknown option --nope, --also-nope')
  // and the flags that do exist still parse, including --version's own value
  expect(() =>
    parseReleaseArgs(['minor', '--dry-run', '--skip-ci-check']),
  ).not.toThrow()
  expect(parseReleaseArgs(['--version', '5.0.0-beta.1']).explicitVersion).toBe(
    '5.0.0-beta.1',
  )
})

// announce.ts shares this: `--dryrun` there posts to Bluesky, Mastodon and the
// newsletter for real.
test('unknownFlags reports only the flags, never a positional or a value', () => {
  expect(
    unknownFlags(['--dry-run', '--tag', 'v4.3.1'], ['--dry-run', '--tag']),
  ).toEqual([])
  expect(unknownFlags(['--dryrun'], ['--dry-run', '--tag'])).toEqual([
    '--dryrun',
  ])
  expect(unknownFlags(['minor', '-v'], ['--dry-run'])).toEqual([])
})

test('isPrerelease', () => {
  expect(isPrerelease('4.4.0')).toBe(false)
  expect(isPrerelease('4.4.0-beta.1')).toBe(true)
})

// "no --tag" and "--tag with its value missing" both used to come out as
// undefined, which findReleasePost reads as "the newest post" — so a typo
// re-announced the previous release to Bluesky, Mastodon and the newsletter.
test('parseTagArg refuses a --tag with no value', () => {
  expect(parseTagArg([])).toBeUndefined()
  expect(parseTagArg(['--dry-run'])).toBeUndefined()
  expect(parseTagArg(['--tag', 'v4.3.1'])).toBe('v4.3.1')
  expect(parseTagArg(['--dry-run', '--tag', 'v4.3.1'])).toBe('v4.3.1')
  expect(() => parseTagArg(['--tag'])).toThrow('--tag needs a value')
  expect(() => parseTagArg(['--tag', '--dry-run'])).toThrow(
    '--tag needs a value',
  )
})

// Both flags are read by `includes`, so the risk is not parsing them but the
// level detection swallowing one — it takes the first non-`--` argument.
test('the flags are independent of the level and of each other', () => {
  expect(parseReleaseArgs(['--skip-ci-check']).skipCiCheck).toBe(true)
  expect(parseReleaseArgs([]).skipCiCheck).toBe(false)
  expect(parseReleaseArgs(['--dry-run']).dryRun).toBe(true)
  expect(parseReleaseArgs([]).dryRun).toBe(false)
  expect(parseReleaseArgs(['--dry-run']).level).toBe('patch')
  expect(parseReleaseArgs(['minor', '--dry-run'])).toMatchObject({
    level: 'minor',
    dryRun: true,
    skipCiCheck: false,
  })
  expect(
    parseReleaseArgs(['--dry-run', '--version', '5.0.0', '--skip-ci-check']),
  ).toMatchObject({
    explicitVersion: '5.0.0',
    dryRun: true,
    skipCiCheck: true,
    level: 'patch',
  })
})
