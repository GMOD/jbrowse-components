import fs from 'fs'
import path from 'path'

import { APP_NAME, ASSETS, DIST, PRODUCT_NAME, VERSION } from './config.ts'
import { packageApp } from './packager.ts'
import { signWindowsFile } from './signing.ts'
import { generateLatestYml, log, run, runQuiet } from './utils.ts'

// Convert Unix path to Windows path for Wine (e.g., /home/user -> Z:\home\user)
function toWinePath(unixPath: string) {
  if (process.platform === 'win32') {
    return unixPath.replace(/\//g, '\\')
  }
  // Use winepath to convert Unix path to Windows path
  return runQuiet(`winepath -w "${unixPath}"`).replace(/\\/g, '\\\\')
}

function createNsisScript(appDir: string, outputExe: string, useWine: boolean) {
  let iconPath = path.join(ASSETS, 'installerIcon.ico')
  let appDirEscaped = appDir
  let outputExeEscaped = outputExe

  if (useWine) {
    // Convert paths to Windows format for Wine
    iconPath = toWinePath(iconPath)
    appDirEscaped = toWinePath(appDir)
    outputExeEscaped = toWinePath(outputExe)
  } else {
    // On Windows, just escape backslashes
    iconPath = iconPath.replace(/\\/g, '\\\\')
    appDirEscaped = appDir.replace(/\\/g, '\\\\')
    outputExeEscaped = outputExe.replace(/\\/g, '\\\\')
  }

  return `
!include "MUI2.nsh"
!include "FileFunc.nsh"

Name "${PRODUCT_NAME}"
OutFile "${outputExeEscaped}"
InstallDir "$PROGRAMFILES64\\${PRODUCT_NAME}"
RequestExecutionLevel admin

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
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayIcon" "$INSTDIR\\${APP_NAME}.exe"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "Publisher" "JBrowse Team"
  WriteRegStr HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "DisplayVersion" "${VERSION}"

  ; Get installed size
  \${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  ; Remove files
  RMDir /r "$INSTDIR"

  ; Remove Start Menu items
  RMDir /r "$SMPROGRAMS\\${PRODUCT_NAME}"

  ; Remove Desktop shortcut
  Delete "$DESKTOP\\${PRODUCT_NAME}.lnk"

  ; Remove registry keys
  DeleteRegKey HKLM "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${PRODUCT_NAME}"
SectionEnd
`
}

function getNsisCommand() {
  // On Windows, use makensis directly
  if (process.platform === 'win32') {
    try {
      runQuiet('makensis -VERSION')
      return { cmd: 'makensis', useWine: false }
    } catch {
      return null
    }
  }
  // On Linux/macOS, try Wine with NSIS
  try {
    // Check if NSIS is installed in Wine's Program Files
    const wineNsis =
      'wine "C:\\Program Files (x86)\\NSIS\\makensis.exe" /VERSION'
    runQuiet(wineNsis)
    return {
      cmd: 'wine "C:\\Program Files (x86)\\NSIS\\makensis.exe"',
      useWine: true,
    }
  } catch {
    return null
  }
}

async function createWindowsInstaller(electronAppDir: string) {
  const exeName = `${APP_NAME}-v${VERSION}-win.exe`
  const exePath = path.join(DIST, exeName)

  const nsis = getNsisCommand()

  if (nsis) {
    log('Creating NSIS installer...')

    const scriptPath = path.join(DIST, 'installer.nsi')
    fs.writeFileSync(
      scriptPath,
      createNsisScript(electronAppDir, exePath, nsis.useWine),
    )

    // Convert script path to Windows format when using Wine
    const scriptArg = nsis.useWine
      ? runQuiet(`winepath -w "${scriptPath}"`)
      : scriptPath
    run(`${nsis.cmd} "${scriptArg}"`)
    fs.unlinkSync(scriptPath)

    signWindowsFile(exePath)

    log(`Created: ${exeName}`)
    return exePath
  }

  // Fallback: create portable ZIP
  log('NSIS not available - creating portable ZIP...')
  const portableZip = path.join(
    DIST,
    `${APP_NAME}-v${VERSION}-win-portable.zip`,
  )
  // Use PowerShell on Windows, zip command on Linux/macOS
  if (process.platform === 'win32') {
    run(
      `powershell -command "Compress-Archive -Path '${electronAppDir}\\*' -DestinationPath '${portableZip}'"`,
    )
  } else {
    run(`cd "${electronAppDir}" && zip -r "${portableZip}" .`)
  }
  log(`Created: ${path.basename(portableZip)}`)
  return portableZip
}

export async function buildWindows({ noInstaller = false } = {}) {
  log('Building Windows package...')

  const electronAppDir = await packageApp('win32', 'x64')

  // For --no-installer mode (e.g., E2E tests), just return the unpacked app dir
  if (noInstaller) {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  // Sign the main executable before packaging
  const mainExe = path.join(electronAppDir, `${APP_NAME}.exe`)
  if (fs.existsSync(mainExe)) {
    signWindowsFile(mainExe)
  }

  const installerPath = await createWindowsInstaller(electronAppDir)
  const installerName = path.basename(installerPath)

  // Cleanup unpacked dir
  fs.rmSync(electronAppDir, { recursive: true })

  // Generate latest.yml
  if (installerName.endsWith('.exe')) {
    fs.writeFileSync(
      path.join(DIST, 'latest.yml'),
      generateLatestYml([installerName]),
    )
    log('Created: latest.yml')
  }

  return installerPath
}
