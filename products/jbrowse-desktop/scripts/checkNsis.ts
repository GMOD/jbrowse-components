#!/usr/bin/env node

/**
 * Compile the Windows installer script, without building the app.
 *
 * `createNsisScript` assembles a ~90-line NSIS program out of a template
 * literal, three separately-escaped paths and a dozen interpolations, and until
 * this existed the only thing that ever parsed the result was the Windows
 * release job — which runs on a tag, after everything else has passed, and which
 * needs a full webpack build and an Electron package before it gets there. A
 * typo in the script therefore surfaced hours later as a failed release rather
 * than as a failed push.
 *
 * This compiles the same script against a stand-in app directory, so it is the
 * NSIS compiler's own verdict on the syntax, the `!include`s, the macros and the
 * section structure — everything except the app bytes. Seconds, and needs only
 * `makensis` (apt: `nsis`).
 *
 * Native makensis, not the Wine one the release uses. The two compile the same
 * language; what differs is only which of `createNsisScript`'s two path-escaping
 * branches produced the paths, and those are pinned separately in
 * packaging/nsis.test.ts. Installing NSIS under Wine takes minutes (see
 * release.yml) and would buy nothing this does not already catch.
 */
import { spawnSync } from 'child_process'
import fs from 'fs'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

import { APP_NAME } from './packaging/config.ts'
import { nsisScriptFor } from './packaging/windows.ts'

function fail(message: string): never {
  console.error(`\n❌ ${message}`)
  process.exit(1)
}

const makensis = process.env.MAKENSIS ?? 'makensis'

if (spawnSync(makensis, ['-VERSION']).status !== 0) {
  fail(
    `${makensis} not found or not runnable. Install NSIS (apt: nsis, brew: makensis), or set MAKENSIS to its path.`,
  )
}

// A stand-in for the packaged Electron tree. `File /r` needs real bytes to
// archive, but not the app's — the script does not care what is in here, and a
// 20-byte file keeps this a compile check rather than a package build.
const work = mkdtempSync(path.join(tmpdir(), 'jbrowse-nsis-check-'))
const appDir = path.join(work, 'app')
fs.mkdirSync(appDir)
fs.writeFileSync(path.join(appDir, `${APP_NAME}.exe`), 'not a real executable')
// a subdirectory too, so `File /r` is exercised as a recursive copy
fs.mkdirSync(path.join(appDir, 'resources'))
fs.writeFileSync(path.join(appDir, 'resources', 'app.asar'), 'not a real asar')

const outputExe = path.join(work, 'installer.exe')
const scriptPath = path.join(work, 'installer.nsi')
fs.writeFileSync(scriptPath, nsisScriptFor(appDir, outputExe, false))

console.log(`Compiling the installer script with ${makensis}...`)
const result = spawnSync(makensis, [scriptPath], { stdio: 'inherit' })

if (result.status !== 0) {
  // left on disk deliberately: a compile error names a line number, and the
  // only way to read that line is to still have the file
  fail(`makensis exited ${result.status}. Script kept at ${scriptPath}`)
}
if (!fs.existsSync(outputExe)) {
  fail(`makensis exited 0 but wrote no installer to ${outputExe}`)
}

console.log(
  `\n✓ installer script compiles (${fs.statSync(outputExe).size} bytes)`,
)
fs.rmSync(work, { recursive: true, force: true })
