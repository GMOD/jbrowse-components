import fs from 'fs'
import path from 'path'

import {
  JBROWSE_PROTOCOL,
  SESSION_EXTENSION,
} from '../../electron/launchTarget.ts'
import { winArtifacts } from './artifacts.ts'
import {
  APP_NAME,
  ASSETS,
  DIST,
  PRODUCT_NAME,
  VERSION,
  packagedApp,
} from './config.ts'
import { createNsisScript } from './nsisScript.ts'
import { packageApp } from './packager.ts'
import { generateLatestYml, log, run, runQuiet } from './utils.ts'
import { verifyWindowsSignature } from './verifyWindows.ts'

import type { Phase } from './config.ts'

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

// dist/jbrowse-desktop-v<version>-win.exe, the one file this platform
// publishes besides its manifest.
function installerPath() {
  const { exe } = winArtifacts({ appName: APP_NAME, version: VERSION })
  return path.join(DIST, exe)
}

function writeUpdateManifest() {
  const { exe, manifest } = winArtifacts({
    appName: APP_NAME,
    version: VERSION,
  })
  fs.writeFileSync(path.join(DIST, manifest), generateLatestYml([exe]))
  log(`Created: ${manifest}`)
}

async function createWindowsInstaller(electronAppDir: string) {
  const exePath = installerPath()
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

  log(`Created: ${path.basename(exePath)}`)
  return exePath
}

/**
 * A Windows build, in whole or in the part this phase covers (see `Phase`).
 *
 * The release signs twice: the app exe, so what Windows runs carries a
 * publisher, and the installer NSIS wraps it in, which is what electron-updater
 * checks before applying an update. `installer` and `finalize` therefore only
 * ever run just downstream of a signing request, so they verify — an unsigned
 * file at either point is a signing step that did nothing, and nothing else
 * would notice until a user's update was refused.
 */
export async function buildWindows({ phase }: { phase: Phase }) {
  if (phase === 'finalize') {
    const exePath = installerPath()
    verifyWindowsSignature(exePath)
    writeUpdateManifest()
    return exePath
  }

  if (phase === 'installer') {
    const { dir, executable } = packagedApp('win')
    verifyWindowsSignature(executable)
    const exePath = await createWindowsInstaller(dir)
    fs.rmSync(dir, { recursive: true })
    return exePath
  }

  log('Building Windows package...')
  const { dir: electronAppDir } = await packageApp('win')

  if (phase === 'app') {
    log(`Unpacked app at: ${electronAppDir}`)
    return electronAppDir
  }

  const exePath = await createWindowsInstaller(electronAppDir)
  fs.rmSync(electronAppDir, { recursive: true })
  writeUpdateManifest()
  return exePath
}
