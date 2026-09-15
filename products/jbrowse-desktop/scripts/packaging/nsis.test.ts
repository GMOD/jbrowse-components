/**
 * @jest-environment node
 */

import { ANALYTICS_OPT_OUT_FILE } from '../../electron/analyticsOptOut.ts'
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
    privacyNoticeFile: '/tmp/privacy-notice.txt',
    analyticsOptOutFile: ANALYTICS_OPT_OUT_FILE,
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

  // A ProgID may not contain spaces, and PRODUCT_NAME ("JBrowse 2", which the
  // fixture above passes) does — so the one the script writes has to be derived
  // from it rather than be it. Asserted against the script because the deriving
  // function is module-local; asserting `'JBrowse2.Session'` has no spaces would
  // only be asking whether the literal three lines up has a space in it.
  test('the ProgID is the product name with the spaces taken out', () => {
    expect(script()).toContain(`Software\\Classes\\${progId}`)
    expect(script()).not.toContain('Software\\Classes\\JBrowse 2.Session')
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
      new RegExp(
        String.raw`\$\{If} \$0 == "${progId}"[\s\S]*DeleteRegValue HKCU "Software\\Classes\\${SESSION_EXTENSION}" ""[\s\S]*\$\{EndIf}`,
      ),
    )
  })

  // OpenWithProgids is a list, one entry per application that can open the
  // type, so an unconditional DeleteRegKey on the extension takes other
  // applications' entries with it — the very harm the test above exists to
  // prevent, one level down. Every removal names a value of ours; the keys go
  // only once empty.
  test('the uninstall never deletes the extension key recursively', () => {
    expect(uninstall()).not.toContain(
      `DeleteRegKey HKCU "Software\\Classes\\${SESSION_EXTENSION}"`,
    )
    expect(uninstall()).toContain(
      `DeleteRegValue HKCU "Software\\Classes\\${SESSION_EXTENSION}\\OpenWithProgids" "${progId}"`,
    )
    expect(uninstall()).toContain(
      `DeleteRegKey /ifempty HKCU "Software\\Classes\\${SESSION_EXTENSION}"`,
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

// electron-updater spawns the installer with --updated and then quits the app,
// so the copy starts while the old exe is still locked and `File` cannot
// overwrite it. The wait has to come before anything is written, and only on
// that flag — an interactive install over a running app is a person who can be
// asked to close it.
test('an --updated install waits for the running app to release its exe', () => {
  const install = script().split('Section "Uninstall"')[0]!
  const wait = install.indexOf('"--updated"')

  expect(wait).toBeGreaterThan(-1)
  expect(wait).toBeLessThan(install.indexOf('File /r'))
  expect(wait).toBeLessThan(install.indexOf('SetOutPath $INSTDIR'))
  // append mode on an exe another process is running is the lock test; it
  // creates the file when there is none, hence the existence guard
  expect(install).toContain('FileOpen $R3 "$INSTDIR\\jbrowse-desktop.exe" a')
  expect(install).toContain(
    '${If} ${FileExists} "$INSTDIR\\jbrowse-desktop.exe"',
  )
  // bounded, so a lock that never clears is a failed install rather than an
  // installer sitting on the machine forever
  expect(install).toContain('${LoopUntil} $R2 >= 240')
})

test('the paths it was handed reach the script', () => {
  expect(script()).toContain('OutFile "/tmp/out.exe"')
  expect(script()).toContain('File /r "/tmp/app\\*.*"')
  expect(script()).toContain('!define MUI_ICON "/tmp/icon.ico"')
})

// Both are conditions of the SignPath Foundation certificate the installer is
// signed with: the privacy policy on screen during installation, and an option
// to turn off what it describes. Neither is visible from the compiled installer
// without running it on Windows, so they are pinned here.
test('the privacy policy is shown before anything is asked or installed', () => {
  const text = script()
  expect(text).toContain(
    '!insertmacro MUI_PAGE_LICENSE "/tmp/privacy-notice.txt"',
  )
  expect(text.indexOf('MUI_PAGE_LICENSE')).toBeLessThan(
    text.indexOf('MUI_PAGE_COMPONENTS'),
  )
  expect(text.indexOf('MUI_PAGE_LICENSE')).toBeLessThan(
    text.indexOf('MUI_PAGE_INSTFILES'),
  )
})

// Checked by default is what the policy on the page before it describes; an
// unchecked default would make the policy wrong rather than cautious.
test('the usage-reporting box is offered and starts checked', () => {
  const text = script()
  expect(text).toContain('Section "Send anonymous usage reports" SecAnalytics')
  expect(text).not.toContain('SectionSetFlags')
  expect(text).not.toContain('Unselect')
})

// Clearing the box has to leave something the app can read, and ticking it has
// to take that away again — a reinstall is how a user changes their mind.
test('the box writes an opt-out file and clearing it removes one', () => {
  const text = script()
  expect(text).toContain(
    `Delete "$INSTDIR\\resources\\${ANALYTICS_OPT_OUT_FILE}"`,
  )
  expect(text).toContain(
    `FileOpen $0 "$INSTDIR\\resources\\${ANALYTICS_OPT_OUT_FILE}" w`,
  )
})

// electron-updater applies a background update by running this installer
// silently, where no page is shown and every section carries its default state.
// Acting on that state would switch reporting back on at every update for
// everyone who had turned it off — silently, which is the whole problem.
test('a silent update does not touch the choice the user made', () => {
  const choice = script().split('Section -AnalyticsChoice')[1]!
  expect(choice.indexOf('${IfNot} ${Silent}')).toBeGreaterThan(-1)
  expect(choice.indexOf('${IfNot} ${Silent}')).toBeLessThan(
    choice.indexOf('SectionIsSelected'),
  )
})

// A section's index constant does not exist until its section is declared, so
// the two hidden sections have to come after the one whose flag they read. The
// compiler says so (`pnpm check:nsis`), but only if the order is wrong here.
test('the hidden sections follow the checkbox they read', () => {
  const text = script()
  expect(text.indexOf('SecAnalytics\n')).toBeLessThan(
    text.indexOf('Section -AnalyticsChoice'),
  )
})

// The relaunch starts the app, and the app reads the opt-out file — so it has
// to be the last thing the installer does, not something racing the section
// that writes it.
test('the relaunch is the last section', () => {
  const text = script()
  expect(text.indexOf('Section -AnalyticsChoice')).toBeLessThan(
    text.indexOf('Section -Relaunch'),
  )
  expect(text.split('Section -Relaunch')[1]).toContain('--force-run')
})
