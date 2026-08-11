// The Windows installer, as an NSIS program.
//
// Its own module, and taking every path and name as a parameter, for the same
// reason artifacts.ts is: config.ts reads `import.meta.dirname`, which jest's
// CJS transform cannot load, so anything importing it is untestable. Here that
// matters more than usual — this string is only otherwise parsed by the Windows
// release job, which runs on a tag after everything else has passed.
//
// The two things that check it:
//   - `pnpm check:nsis` compiles it with makensis, which is the only thing that
//     can tell you it is valid NSIS at all
//   - nsis.test.ts pins the behaviours that compile fine either way and are
//     only observable on a user's machine
//
// Escaping is the caller's job (see windows.ts): whether a path is spelled the
// Wine way or the native way depends on which compiler is about to read it, and
// that decision needs to run a subprocess.

export interface NsisScriptOptions {
  /** the packaged Electron tree to archive, already escaped for the compiler */
  appDir: string
  /** where the installer is written, already escaped */
  outputExe: string
  /** installer/uninstaller icon, already escaped */
  iconPath: string
  /** the executable's basename inside appDir, without .exe */
  appName: string
  /** the user-visible name: install dir, shortcuts, Add/Remove Programs */
  productName: string
  version: string
  /** url scheme to claim, so an "open in Desktop" link launches this install */
  protocol: string
  /** file extension to claim, so a saved session opens on double-click */
  sessionExtension: string
}

// Windows names a file type by a "ProgID" key under Software\Classes, which the
// extension key then points at. It may not contain spaces, so it cannot just be
// the product name.
function progIdFor(productName: string) {
  return `${productName.replaceAll(/[^A-Za-z0-9]/g, '')}.Session`
}

// SHCNE_ASSOCCHANGED. Explorer caches associations, so a new one is not visible
// — no icon, no double-click — until something tells the shell to reread them.
const NOTIFY_SHELL =
  "System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'"

export function createNsisScript({
  appDir,
  outputExe,
  iconPath,
  appName,
  productName,
  version,
  protocol,
  sessionExtension,
}: NsisScriptOptions) {
  const progId = progIdFor(productName)
  return `
Unicode true

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

Name "${productName}"
OutFile "${outputExe}"
; Per-user install: no admin/UAC, so electron-updater can apply background
; updates silently instead of raising a UAC prompt on every update. Location and
; registry hive (HKCU) mirror electron-builder's default per-user NSIS target.
InstallDir "$LOCALAPPDATA\\Programs\\${productName}"
RequestExecutionLevel user

!define MUI_ICON "${iconPath}"
!define MUI_UNICON "${iconPath}"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath $INSTDIR

  ; Copy all files from the app directory
  File /r "${appDir}\\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\\${productName}"
  CreateShortcut "$SMPROGRAMS\\${productName}\\${productName}.lnk" "$INSTDIR\\${appName}.exe"
  CreateShortcut "$SMPROGRAMS\\${productName}\\Uninstall.lnk" "$INSTDIR\\Uninstall.exe"

  ; Create Desktop shortcut
  CreateShortcut "$DESKTOP\\${productName}.lnk" "$INSTDIR\\${appName}.exe"

  ; Write registry keys for Add/Remove Programs
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${productName}" "DisplayName" "${productName}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${productName}" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${productName}" "DisplayIcon" "$INSTDIR\\${appName}.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${productName}" "Publisher" "JBrowse Team"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${productName}" "DisplayVersion" "${version}"

  ; Register the ${protocol}:// url scheme, so an "open in Desktop" link
  ; on a web page launches this install. macOS gets this from Info.plist and
  ; Linux from the .desktop file; on Windows it is registry-only.
  WriteRegStr HKCU "Software\\Classes\\${protocol}" "" "URL:${productName} Protocol"
  WriteRegStr HKCU "Software\\Classes\\${protocol}" "URL Protocol" ""
  WriteRegStr HKCU "Software\\Classes\\${protocol}\\DefaultIcon" "" "$INSTDIR\\${appName}.exe,0"
  WriteRegStr HKCU "Software\\Classes\\${protocol}\\shell\\open\\command" "" '"$INSTDIR\\${appName}.exe" "%1"'

  ; Associate ${sessionExtension}, so double-clicking a saved session opens it.
  ; The app has always been able to open one from argv (see findLaunchTarget)
  ; and "Save session as..." forces this extension precisely so a session is
  ; identifiable — but on Windows nothing connected the two, and Explorer had
  ; no idea what the file was. Registered as a ProgID that the extension points
  ; at, which is the shape Windows expects; ${sessionExtension} alone with a
  ; command under it is the old Win3.1 form and does not get an icon.
  ;
  ; .json is deliberately NOT claimed even though the app opens those too: it is
  ; the most common config format on the machine, and taking the default for all
  ; of them is not something an install should do.
  WriteRegStr HKCU "Software\\Classes\\${progId}" "" "${productName} Session"
  WriteRegStr HKCU "Software\\Classes\\${progId}\\DefaultIcon" "" "$INSTDIR\\${appName}.exe,0"
  WriteRegStr HKCU "Software\\Classes\\${progId}\\shell\\open\\command" "" '"$INSTDIR\\${appName}.exe" "%1"'
  WriteRegStr HKCU "Software\\Classes\\${sessionExtension}" "" "${progId}"
  ; also list it under "Open with", which is where the user goes when something
  ; else has taken the default
  WriteRegStr HKCU "Software\\Classes\\${sessionExtension}\\OpenWithProgids" "${progId}" ""
  ${NOTIFY_SHELL}

  ; Get installed size
  \${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${productName}" "EstimatedSize" "$0"

  ; electron-updater applies a background update by running this installer
  ; silently with --force-run (autoUpdater.ts calls quitAndInstall(true, true)).
  ; Relaunch the app so a background update does not leave the user with no
  ; window; a normal interactive install has no --force-run and does not.
  \${GetParameters} $R0
  ClearErrors
  \${GetOptions} $R0 "--force-run" $R1
  \${IfNot} \${Errors}
    Exec '"$INSTDIR\\${appName}.exe"'
  \${EndIf}
SectionEnd

Section "Uninstall"
  ; Step out of $INSTDIR before deleting it. RMDir cannot remove the current
  ; working directory — the NSIS manual's own example for this is literally
  ; "SetOutPath $TEMP" followed by "RMDir /r $INSTDIR" — and the uninstaller
  ; runs from $INSTDIR, so without this the install directory survived an
  ; uninstall with its contents half-removed.
  SetOutPath $TEMP

  ; Remove files
  RMDir /r "$INSTDIR"

  ; Windows holds a lock on the running Uninstall.exe, so the RMDir above cannot
  ; take it, and cannot take $INSTDIR while it is still in there. Both go at the
  ; next reboot. Nothing prompts for one: there is no finish page to raise it.
  Delete /REBOOTOK "$INSTDIR\\Uninstall.exe"
  RMDir /REBOOTOK "$INSTDIR"

  ; Remove Start Menu items
  RMDir /r "$SMPROGRAMS\\${productName}"

  ; Remove Desktop shortcut
  Delete "$DESKTOP\\${productName}.lnk"

  ; Remove registry keys
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${productName}"
  DeleteRegKey HKCU "Software\\Classes\\${protocol}"

  ; The file association. The ProgID is ours and goes unconditionally; the
  ; extension key is shared, so only drop it if it still points at us. Another
  ; application (or a newer JBrowse install) may have taken the default since,
  ; and removing it then would leave ${sessionExtension} associated with nothing
  ; on the way out of an app the user was not even uninstalling.
  DeleteRegKey HKCU "Software\\Classes\\${progId}"
  ReadRegStr $0 HKCU "Software\\Classes\\${sessionExtension}" ""
  \${If} $0 == "${progId}"
    DeleteRegKey HKCU "Software\\Classes\\${sessionExtension}"
  \${Else}
    DeleteRegValue HKCU "Software\\Classes\\${sessionExtension}\\OpenWithProgids" "${progId}"
  \${EndIf}
  ${NOTIFY_SHELL}
SectionEnd
`
}
