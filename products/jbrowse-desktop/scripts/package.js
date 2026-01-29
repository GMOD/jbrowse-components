#!/usr/bin/env node

/**
 * Electron packaging script for JBrowse Desktop
 *
 * Produces:
 * - Linux: AppImage + latest-linux.yml
 * - macOS: DMG + ZIP + latest-mac.yml (with code signing & notarization)
 * - Windows: NSIS EXE + latest.yml (with code signing)
 *
 * Auto-updates work via electron-updater reading latest*.yml from GitHub releases
 */

import fs from 'fs'
import path from 'path'

import { BUILD, DIST, VERSION } from './packaging/config.js'
import { buildLinux } from './packaging/linux.js'
import { buildMac } from './packaging/mac.js'
import { ensureDir, fileSize, log } from './packaging/utils.js'
import { buildWindows } from './packaging/windows.js'

function parseArgs() {
  const args = process.argv.slice(2)
  const platforms = []

  for (const arg of args) {
    if (arg === '--linux' || arg === 'linux') {
      platforms.push('linux')
    } else if (arg === '--mac' || arg === 'mac' || arg === '--darwin') {
      platforms.push('mac')
    } else if (arg === '--win' || arg === 'win' || arg === '--windows') {
      platforms.push('win')
    } else if (arg === '--all') {
      return ['linux', 'mac', 'win']
    }
  }

  if (platforms.length === 0) {
    const p = process.platform
    return [p === 'darwin' ? 'mac' : p === 'win32' ? 'win' : 'linux']
  }

  return platforms
}

function printBanner(platforms) {
  const macStatus = process.env.APPLE_ID
    ? '✓ Enabled'
    : '✗ Disabled (set APPLE_ID)'
  const winStatus = process.env.WINDOWS_SIGN_CREDENTIAL_ID
    ? '✓ Enabled'
    : '✗ Disabled (set WINDOWS_SIGN_*)'

  console.log(`
╔══════════════════════════════════════════════════════╗
║  JBrowse Desktop Packager v${VERSION.padEnd(27)}║
║  Platforms: ${platforms.join(', ').padEnd(42)}║
║                                                      ║
║  Code Signing:                                       ║
║    macOS: ${macStatus.padEnd(44)}║
║    Windows: ${winStatus.padEnd(42)}║
╚══════════════════════════════════════════════════════╝`)
}

function printResults() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  Build Complete!                                     ║
╚══════════════════════════════════════════════════════╝`)

  const files = fs.readdirSync(DIST).filter(f => {
    const p = path.join(DIST, f)
    return fs.statSync(p).isFile() && !f.startsWith('.')
  })

  console.log('\nArtifacts:')
  for (const file of files.sort()) {
    const size = fileSize(path.join(DIST, file))
    const sizeMb =
      size > 1024 * 1024
        ? `${(size / 1024 / 1024).toFixed(1)} MB`
        : `${(size / 1024).toFixed(1)} KB`
    console.log(`  ${file.padEnd(50)} ${sizeMb}`)
  }
}

async function main() {
  const platforms = parseArgs()
  printBanner(platforms)

  log('Preparing dist directory...')
  fs.rmSync(DIST, { recursive: true, force: true })
  ensureDir(DIST)

  if (
    !fs.existsSync(BUILD) ||
    !fs.existsSync(path.join(BUILD, 'electron.js'))
  ) {
    console.error('\n❌ Build directory not found. Run `pnpm build` first.')
    process.exit(1)
  }

  const builders = { linux: buildLinux, mac: buildMac, win: buildWindows }

  for (const platform of platforms) {
    try {
      await builders[platform]()
    } catch (err) {
      console.error(`\n❌ Error building for ${platform}:`, err.message)
      if (process.env.DEBUG) {
        console.error(err.stack)
      }
    }
  }

  printResults()
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
