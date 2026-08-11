/**
 * @jest-environment node
 */

import {
  JBROWSE_PROTOCOL,
  SESSION_EXTENSION,
} from '../../electron/launchTarget.ts'
import { createNsisScript } from './nsisScript.ts'

// The Windows installer, as source. `pnpm check:nsis` asks the NSIS compiler
// whether this parses; these pin the handful of behaviours that compile fine
// either way and are only observable on a user's machine — where the feedback
// loop is a release, a download, and someone noticing.
//
// Literal paths and names rather than the real ones from config.ts: nothing here
// is about which directory a build happens in, and windows.ts — which owns the
// escaping, and imports config.ts — cannot be loaded under jest at all. See the
// note at the top of nsisScript.ts.
const script = () =>
  createNsisScript({
    appDir: '/tmp/app',
    outputExe: '/tmp/out.exe',
    iconPath: '/tmp/icon.ico',
    appName: 'jbrowse-desktop',
    productName: 'JBrowse 2',
    version: '4.4.0',
    protocol: JBROWSE_PROTOCOL,
    sessionExtension: SESSION_EXTENSION,
  })

// RMDir cannot remove the current working directory, and the uninstaller runs
// from $INSTDIR — so without the SetOutPath this deleted the contents and left
// the directory, with Uninstall.exe still in it, under %LOCALAPPDATA%\Programs
// forever. The NSIS manual's own example for RMDir is this exact pair.
test('the uninstaller steps out of $INSTDIR before removing it', () => {
  const uninstall = script().split('Section "Uninstall"')[1]!

  expect(uninstall.indexOf('SetOutPath $TEMP')).toBeGreaterThan(-1)
  expect(uninstall.indexOf('SetOutPath $TEMP')).toBeLessThan(
    uninstall.indexOf('RMDir /r "$INSTDIR"'),
  )
})

// Windows holds a lock on the running Uninstall.exe, so the RMDir above cannot
// take it or the directory containing it; both have to be scheduled instead.
test('the uninstaller schedules what it cannot delete while running', () => {
  const uninstall = script().split('Section "Uninstall"')[1]!

  expect(uninstall).toContain('Delete /REBOOTOK "$INSTDIR\\Uninstall.exe"')
  expect(uninstall).toContain('RMDir /REBOOTOK "$INSTDIR"')
})

// Windows is the one platform where the jbrowse:// scheme is registry-only —
// macOS gets it from Info.plist and Linux from the .desktop file — so dropping
// these lines silently stops "open in Desktop" links working on Windows alone,
// and the uninstall keys are what stops them pointing at a deleted install.
test('the installer claims the jbrowse:// scheme and the uninstall removes it', () => {
  const [install, uninstall] = script().split('Section "Uninstall"') as [
    string,
    string,
  ]

  expect(install).toContain(
    `WriteRegStr HKCU "Software\\Classes\\${JBROWSE_PROTOCOL}" "URL Protocol" ""`,
  )
  expect(install).toContain(
    `Software\\Classes\\${JBROWSE_PROTOCOL}\\shell\\open\\command`,
  )
  expect(uninstall).toContain(
    `DeleteRegKey HKCU "Software\\Classes\\${JBROWSE_PROTOCOL}"`,
  )
})

// The app has always opened a session handed to it on argv, and "Save session
// as..." forces .jbrowse so that one is identifiable — but nothing on Windows
// connected the two, so double-clicking a saved session did nothing at all.
// Like the protocol above, this is registry-only on Windows.
describe(`the ${SESSION_EXTENSION} file association`, () => {
  const install = () => script().split('Section "Uninstall"')[0]!
  const uninstall = () => script().split('Section "Uninstall"')[1]!
  const progId = 'JBrowse2.Session'

  // A bare extension key with a command under it is the Win3.1 form: it still
  // launches, but Explorer shows no icon and no type description.
  test('goes through a ProgID that the extension points at', () => {
    expect(install()).toContain(
      `WriteRegStr HKCU "Software\\Classes\\${progId}\\shell\\open\\command" "" '"$INSTDIR\\jbrowse-desktop.exe" "%1"'`,
    )
    expect(install()).toContain(
      `WriteRegStr HKCU "Software\\Classes\\${SESSION_EXTENSION}" "" "${progId}"`,
    )
    expect(install()).toContain(
      `WriteRegStr HKCU "Software\\Classes\\${progId}\\DefaultIcon"`,
    )
  })

  // A ProgID may not contain spaces, and the product name does.
  test('the ProgID has no spaces', () => {
    expect(progId).not.toMatch(/\s/)
  })

  // .json is the other extension findLaunchTarget accepts. Claiming it would
  // make JBrowse the default application for every config file on the machine.
  test('claims only the session extension, never .json', () => {
    expect(script()).not.toContain('Software\\Classes\\.json')
  })

  // Explorer caches associations; without the notify the new type has no icon
  // and does not open until the next logon.
  test('tells the shell associations changed, on install and uninstall', () => {
    expect(install()).toContain('SHChangeNotify')
    expect(uninstall()).toContain('SHChangeNotify')
  })

  // The ProgID is ours to delete. The extension key is shared — a newer install
  // or another app may own it by now — so removing it unconditionally would
  // break an association this uninstall has nothing to do with.
  test('the uninstall gives back the extension only if it still owns it', () => {
    expect(uninstall()).toContain(
      `DeleteRegKey HKCU "Software\\Classes\\${progId}"`,
    )
    expect(uninstall()).toContain(
      `ReadRegStr $0 HKCU "Software\\Classes\\${SESSION_EXTENSION}" ""`,
    )
    expect(uninstall()).toMatch(
      /\$\{If} \$0 == "JBrowse2\.Session"[\s\S]*DeleteRegKey HKCU "Software\\Classes\\\.jbrowse"[\s\S]*\$\{Else}/,
    )
  })
})

// A per-user install is what lets electron-updater apply a background update
// without raising UAC on every one. RequestExecutionLevel admin would move the
// install to Program Files and make each update a prompt.
test('the install is per-user, so background updates need no UAC', () => {
  expect(script()).toContain('RequestExecutionLevel user')
  expect(script()).toContain('InstallDir "$LOCALAPPDATA\\Programs\\')
  // every key it writes has to be in the hive a non-elevated install can write
  expect(script()).not.toMatch(/WriteRegStr HKLM|WriteRegDWORD HKLM/)
})

// electron-updater applies an update by running this installer silently with
// --force-run (autoUpdater's quitAndInstall(true, true)). Without the relaunch
// the user's app disappears mid-session and does not come back.
test('a --force-run install relaunches the app', () => {
  const install = script().split('Section "Uninstall"')[0]!

  expect(install).toContain('"--force-run"')
  expect(install).toContain('Exec \'"$INSTDIR\\jbrowse-desktop.exe"\'')
})

test('the paths it was handed reach the script', () => {
  expect(script()).toContain('OutFile "/tmp/out.exe"')
  expect(script()).toContain('File /r "/tmp/app\\*.*"')
  expect(script()).toContain('!define MUI_ICON "/tmp/icon.ico"')
})
