import fs from 'fs'
import path from 'path'

import { JBROWSE_PROTOCOL } from '../../electron/launchTarget.ts'
import { APP_NAME, ASSETS, DIST, PRODUCT_NAME, VERSION } from './config.ts'
import { packageApp } from './packager.ts'
import { signWindowsFile } from './signing.ts'
import { generateLatestYml, log, run, runQuiet } from './utils.ts'

// Convert Unix path to Windows path for Wine (e.g., /home/user -> Z:\home\user)
function toWinePath(unixPath: string) {
  if (process.platform === 'win32') {
    return unixPath.replace(/\//g, '\\')
  }
  return runQuiet(`winepath -w "${unixPath}"`).replace(/\\/g, '\\\\')
}

function createNsisScript(appDir: string, outputExe: string, useWine: boolean) {
  const iconPath = useWine
    ? toWinePath(path.join(ASSETS, 'installerIcon.ico'))
    : path.join(ASSETS, 'installerIcon.ico').replace(/\\/g, '\\\\')
  const appDirEscaped = useWine
    ? toWinePath(appDir)
    : appDir.replace(/\\/g, '\\\\')
  const outputExeEscaped = useWine
    ? toWinePath(outputExe)
    : outputExe.replace(/\\/g, '\\\\')

  return `
Unicode true

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

Name "${PRODUCT_NAME}"
OutFile "${outputExeEscaped}"
; Per-user install: no admin/UAC, so electron-updater can apply background
; updates silently instead of raising a UAC prompt on every update. Location and
; registry hive (HKCU) mirror electron-builder's default per-user NSIS target.
InstallDir "$LOCALAPPDATA\\Programs\\${PRODUCT_NAME}"
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
  File /r "${appDirEscaped}\\*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\\Uninstall.exe"

  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\\${PRODUCT_NAME}\\${PRODUCT_NAME}.lnk" "$INSTDIR\\${APP_NAME}.exe"
  CreateShortcut "$SMPROGRAMS\\${PRODUCT_NAME}\\Uninstall.lnk" "$INSTDIR\\Uninstall.exe"

  ; Create Desktop shortcut
  CreateShortcut "$DESKTOP\\${PRODUCT_NAME}.lnk" "$INSTDIR\\${APP_NAME}.exe"

  ; Write registry keys for Add/Remove Programs
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayIcon" "$INSTDIR\\${APP_NAME}.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "Publisher" "JBrowse Team"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayVersion" "${VERSION}"

  ; Register the ${JBROWSE_PROTOCOL}:// url scheme, so an "open in Desktop" link
  ; on a web page launches this install. macOS gets this from Info.plist and
  ; Linux from the .desktop file; on Windows it is registry-only.
  WriteRegStr HKCU "Software\\Classes\\${JBROWSE_PROTOCOL}" "" "URL:${PRODUCT_NAME} Protocol"
  WriteRegStr HKCU "Software\\Classes\\${JBROWSE_PROTOCOL}" "URL Protocol" ""
  WriteRegStr HKCU "Software\\Classes\\${JBROWSE_PROTOCOL}\\DefaultIcon" "" "$INSTDIR\\${APP_NAME}.exe,0"
  WriteRegStr HKCU "Software\\Classes\\${JBROWSE_PROTOCOL}\\shell\\open\\command" "" '"$INSTDIR\\${APP_NAME}.exe" "%1"'

  ; Get installed size
  \${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "EstimatedSize" "$0"

  ; electron-updater applies a background update by running this installer
  ; silently with --force-run (autoUpdater.ts calls quitAndInstall(true, true)).
  ; Relaunch the app so a background update does not leave the user with no
  ; window; a normal interactive install has no --force-run and does not.
  \${GetParameters} $R0
  ClearErrors
  \${GetOptions} $R0 "--force-run" $R1
  \${IfNot} \${Errors}
    Exec '"$INSTDIR\\${APP_NAME}.exe"'
  \${EndIf}
SectionEnd

Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove Start Menu items
  RMDir /r "$SMPROGRAMS\\${PRODUCT_NAME}"

  ; Remove Desktop shortcut
  Delete "$DESKTOP\\${PRODUCT_NAME}.lnk"

  ; Remove registry keys
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}"
  DeleteRegKey HKCU "Software\\Classes\\${JBROWSE_PROTOCOL}"
SectionEnd
`
}

function getNsisCommand(): { cmd: string; useWine: boolean } {
  if (process.platform === 'win32') {
    try {
      runQuiet('makensis -VERSION')
      return { cmd: 'makensis', useWine: false }
    } catch {
      throw new Error('makensis not found — install NSIS for Windows')
    }
  }
  try {
    runQuiet('wine "C:\\Program Files (x86)\\NSIS\\makensis.exe" /VERSION')
    return {
      cmd: 'wine "C:\\Program Files (x86)\\NSIS\\makensis.exe"',
      useWine: true,
    }
  } catch {
    throw new Error(
      'NSIS not found in Wine — install NSIS under Wine (Linux/macOS)',
    )
  }
}

async function createWindowsInstaller(electronAppDir: string) {
  const exeName = `${APP_NAME}-v${VERSION}-win.exe`
  const exePath = path.join(DIST, exeName)
  const nsis = getNsisCommand()

  log('Creating NSIS installer...')
  const scriptPath = path.join(DIST, 'installer.nsi')
  fs.writeFileSync(
    scriptPath,
    createNsisScript(electronAppDir, exePath, nsis.useWine),
  )

  const scriptArg = nsis.useWine
    ? runQuiet(`winepath -w "${scriptPath}"`)
    : scriptPath
  try {
    run(`${nsis.cmd} "${scriptArg}"`)
  } finally {
    fs.rmSync(scriptPath, { force: true })
  }

  signWindowsFile(exePath)
  log(`Created: ${exeName}`)
  return exePath
}

export async function buildWindows({ noInstaller = false } = {}) {
  log('Building Windows package...')

  const electronAppDir = await packageApp('win32', 'x64')

  if (noInstaller) {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  const mainExe = path.join(electronAppDir, `${APP_NAME}.exe`)
  signWindowsFile(mainExe)

  const installerPath = await createWindowsInstaller(electronAppDir)
  fs.rmSync(electronAppDir, { recursive: true })

  fs.writeFileSync(
    path.join(DIST, 'latest.yml'),
    generateLatestYml([path.basename(installerPath)]),
  )
  log('Created: latest.yml')

  return installerPath
}
