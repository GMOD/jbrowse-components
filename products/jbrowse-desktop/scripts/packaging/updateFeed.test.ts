import { appUpdateYml, latestYml } from './updateFeed.ts'

const files = [
  { name: 'jbrowse-desktop-v4.4.0-mac.zip', sha512: 'zipHash==', size: 12 },
  { name: 'jbrowse-desktop-v4.4.0-mac.dmg', sha512: 'dmgHash==', size: 34 },
]

// The feed is only ever read by an app polling for an update, which answers a
// short or malformed one with silence — so the shape is pinned here rather than
// discovered on a user's machine.
test('the manifest describes every file it was given', () => {
  expect(latestYml({ version: '4.4.0', files })).toContain(
    [
      'files:',
      "  - url: 'jbrowse-desktop-v4.4.0-mac.zip'",
      "    sha512: 'zipHash=='",
      '    size: 12',
      "  - url: 'jbrowse-desktop-v4.4.0-mac.dmg'",
      "    sha512: 'dmgHash=='",
      '    size: 34',
    ].join('\n'),
  )
})

// The pre-`files` fields older clients read. They name one artifact, so the
// caller's first entry has to be the one its platform updates FROM — mac's zip,
// not the dmg beside it, which is the human download and which Squirrel cannot
// apply.
test('the legacy path fields repeat the first file', () => {
  const yml = latestYml({ version: '4.4.0', files })
  expect(yml).toContain("path: 'jbrowse-desktop-v4.4.0-mac.zip'")
  expect(yml).toContain("sha512: 'zipHash=='")
  expect(yml).not.toContain("path: 'jbrowse-desktop-v4.4.0-mac.dmg'")
})

// A quoted version, because YAML reads an unquoted one as a number as soon as it
// has fewer than two dots, and electron-updater hands whatever it parses to
// semver.
test('the version is a string whatever it looks like', () => {
  expect(latestYml({ version: '5.0', files })).toContain("version: '5.0'")
  expect(latestYml({ version: '5.0.0-beta.4', files })).toContain(
    "version: '5.0.0-beta.4'",
  )
})

// A manifest listing nothing is well-formed, uploads cleanly, and answers every
// client with "no files" — the silent shortfall artifacts.ts is about, one level
// down. Refusing to write it is the only place that can be caught.
test('a manifest with no files is refused', () => {
  expect(() => latestYml({ version: '4.4.0', files: [] })).toThrow(
    /listing no files/,
  )
})

const feed = { owner: 'GMOD', repo: 'jbrowse-components', cacheDirName: 'c' }

test('app-update.yml points at the releases the packagers upload to', () => {
  expect(appUpdateYml(feed)).toBe(
    'provider: github\nowner: GMOD\nrepo: jbrowse-components\nupdaterCacheDirName: c\n',
  )
})

// NsisUpdater checks the downloaded installer's Authenticode publisher only
// when this field is present — absent, verifySignature returns null and the
// check does not happen at all. It has to be the certificate's exact CN, so
// nothing invents one, and an unset environment leaves the file as it was.
test('publisherName appears only when it was supplied', () => {
  expect(appUpdateYml(feed)).not.toContain('publisherName')
  expect(appUpdateYml({ ...feed, publisherName: 'Some Org Inc.' })).toContain(
    "publisherName: 'Some Org Inc.'",
  )
})
