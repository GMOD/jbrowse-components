import {
  isPrerelease,
  nextVersion,
  parseReleaseArgs,
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
  expect(() =>
    nextVersion({ previousVersion: '4.4.0-beta.1', level: 'patch' }),
  ).toThrow('not a plain X.Y.Z')
})

test('isPrerelease', () => {
  expect(isPrerelease('4.4.0')).toBe(false)
  expect(isPrerelease('4.4.0-beta.1')).toBe(true)
})

test('--skip-ci-check is independent of the level', () => {
  expect(parseReleaseArgs(['--skip-ci-check']).skipCiCheck).toBe(true)
  expect(parseReleaseArgs([]).skipCiCheck).toBe(false)
})
