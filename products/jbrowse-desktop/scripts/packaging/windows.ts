import fs from 'fs'
import path from 'path'

import {
  JBROWSE_PROTOCOL,
  SESSION_EXTENSION,
} from '../../electron/launchTarget.ts'
import { winArtifacts } from './artifacts.ts'
import { APP_NAME, ASSETS, DIST, PRODUCT_NAME, VERSION } from './config.ts'
import { createNsisScript } from './nsisScript.ts'
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

// Spell a path the way the compiler about to read it expects: through Wine's
// drive mapping when makensis runs under Wine, with backslashes doubled for
// NSIS's own string escaping otherwise.
function escapePath(p: string, useWine: boolean) {
  return useWine ? toWinePath(p) : p.replace(/\\/g, '\\\\')
}

// The installer script for a packaged tree, ready to hand to makensis.
//
// Exported for `pnpm check:nsis`, which compiles the result — so that check
// covers the escaping decided here as well as the script text itself, which
// lives in nsisScript.ts and is pinned by nsis.test.ts. Until both existed, the
// only thing that ever parsed this was the Windows release job.
export function nsisScriptFor(
  appDir: string,
  outputExe: string,
  useWine: boolean,
) {
  return createNsisScript({
    appDir: escapePath(appDir, useWine),
    outputExe: escapePath(outputExe, useWine),
    iconPath: escapePath(path.join(ASSETS, 'installerIcon.ico'), useWine),
    appName: APP_NAME,
    productName: PRODUCT_NAME,
    version: VERSION,
    protocol: JBROWSE_PROTOCOL,
    sessionExtension: SESSION_EXTENSION,
  })
}

// A native makensis cross-compiles the Windows installer from any host, and is
// what the release runs and what `pnpm check:nsis` compiles this script with.
// Wine-hosted NSIS stays as a fallback for a machine that only has that.
function getNsisCommand(): { cmd: string; useWine: boolean } {
  try {
    runQuiet('makensis -VERSION')
    return { cmd: 'makensis', useWine: false }
  } catch {
    if (process.platform === 'win32') {
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
      'NSIS not found — install it natively (apt: nsis, brew: makensis) or under Wine',
    )
  }
}

async function createWindowsInstaller(electronAppDir: string) {
  const { exe: exeName } = winArtifacts({
    appName: APP_NAME,
    version: VERSION,
  })
  const exePath = path.join(DIST, exeName)
  const nsis = getNsisCommand()

  log('Creating NSIS installer...')
  const scriptPath = path.join(DIST, 'installer.nsi')
  fs.writeFileSync(
    scriptPath,
    nsisScriptFor(electronAppDir, exePath, nsis.useWine),
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

  const { dir: electronAppDir, executable: mainExe } = await packageApp('win')

  if (noInstaller) {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  signWindowsFile(mainExe)

  const installerPath = await createWindowsInstaller(electronAppDir)
  fs.rmSync(electronAppDir, { recursive: true })

  const { manifest } = winArtifacts({ appName: APP_NAME, version: VERSION })
  fs.writeFileSync(
    path.join(DIST, manifest),
    generateLatestYml([path.basename(installerPath)]),
  )
  log(`Created: ${manifest}`)

  return installerPath
}
