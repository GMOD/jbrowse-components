import {
  linuxArtifacts,
  macArtifacts,
  releaseArtifacts,
  unpackedApp,
  winArtifacts,
} from './artifacts.ts'

const app = { appName: 'jbrowse-desktop', version: '4.4.0' }

// These are the asset names on the published releases, and the desktop
// auto-updater resolves them from the manifest — so they are a compatibility
// surface, not an internal detail. Pinned literally: a rename here has to be a
// deliberate edit to this test, not a side effect of touching a template
// string in one of the three packagers.
test('the artifact names are the ones the published releases carry', () => {
  expect(linuxArtifacts(app)).toEqual({
    appImage: 'jbrowse-desktop-v4.4.0-linux.AppImage',
    manifest: 'latest-linux.yml',
  })
  expect(macArtifacts(app)).toEqual({
    dmg: 'jbrowse-desktop-v4.4.0-mac.dmg',
    zip: 'jbrowse-desktop-v4.4.0-mac.zip',
    manifest: 'latest-mac.yml',
  })
  expect(winArtifacts(app)).toEqual({
    exe: 'jbrowse-desktop-v4.4.0-win.exe',
    // unsuffixed on purpose — electron-updater looks for exactly this on win
    manifest: 'latest.yml',
  })
})

// publish.ts requires every name this returns to be on disk before it uploads
// anything, so an omission here is an artifact that silently never ships.
test('releaseArtifacts collects the installers and the update manifest', () => {
  expect(releaseArtifacts(['mac'], app)).toEqual([
    'jbrowse-desktop-v4.4.0-mac.dmg',
    'jbrowse-desktop-v4.4.0-mac.zip',
    'latest-mac.yml',
  ])
  expect(releaseArtifacts(['linux', 'win'], app)).toEqual([
    'jbrowse-desktop-v4.4.0-linux.AppImage',
    'latest-linux.yml',
    'jbrowse-desktop-v4.4.0-win.exe',
    'latest.yml',
  ])
  expect(releaseArtifacts([], app)).toEqual([])
})

// A prerelease is tagged v5.0.0-beta.1 and its assets have to match, or the
// `gh release upload "v$VERSION"` target and the file names disagree.
test('a prerelease version flows through the names unaltered', () => {
  expect(
    releaseArtifacts(['mac'], { ...app, version: '5.0.0-beta.1' }),
  ).toContain('jbrowse-desktop-v5.0.0-beta.1-mac.zip')
})

// The browser-test harness resolves the binary to launch from here rather than
// from a build, so darwin is only ever right if this is — and it was not: a
// two-way win32/linux ternary sent a macOS run at the linux path.
test('the unpacked tree is where @electron/packager puts it', () => {
  const names = { appName: 'jbrowse-desktop', productName: 'JBrowse 2' }
  expect(unpackedApp('linux', names)).toMatchObject({
    dir: 'unpacked/jbrowse-desktop-linux-x64',
    executable: 'unpacked/jbrowse-desktop-linux-x64/jbrowse-desktop',
  })
  expect(unpackedApp('win', names)).toMatchObject({
    dir: 'unpacked/jbrowse-desktop-win32-x64',
    executable: 'unpacked/jbrowse-desktop-win32-x64/jbrowse-desktop.exe',
  })
  expect(unpackedApp('mac', names)).toMatchObject({
    dir: 'unpacked/JBrowse 2-darwin-universal',
    bundle: 'unpacked/JBrowse 2-darwin-universal/JBrowse 2.app',
    executable:
      'unpacked/JBrowse 2-darwin-universal/JBrowse 2.app/Contents/MacOS/JBrowse 2',
  })
})
