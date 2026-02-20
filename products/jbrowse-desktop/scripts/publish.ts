#!/usr/bin/env node

/**
 * Publish script for JBrowse Desktop
 *
 * Uploads packaged artifacts to GitHub releases using the gh CLI.
 * Supports --publish always flag for compatibility with old electron-builder commands.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

import { DIST, VERSION } from './packaging/config.ts'

function parseArgs() {
  const args = process.argv.slice(2)
  let publish = false
  const platforms: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--publish' && args[i + 1] === 'always') {
      publish = true
      i++
    } else if (arg === '--linux') {
      platforms.push('linux')
    } else if (arg === '--mac') {
      platforms.push('mac')
    } else if (arg === '--win') {
      platforms.push('win')
    }
  }

  return { publish, platforms }
}

function getArtifacts(platforms: string[]) {
  const artifacts: string[] = []

  if (!fs.existsSync(DIST)) {
    return artifacts
  }

  const files = fs.readdirSync(DIST)

  for (const file of files) {
    const filePath = path.join(DIST, file)
    const stat = fs.statSync(filePath)

    if (!stat.isFile()) {
      continue
    }

    // Match artifacts by platform
    if (
      platforms.includes('win') &&
      (file.endsWith('.exe') || file.includes('-win'))
    ) {
      artifacts.push(filePath)
    } else if (
      platforms.includes('linux') &&
      (file.endsWith('.AppImage') || file.includes('-linux'))
    ) {
      artifacts.push(filePath)
    } else if (
      platforms.includes('mac') &&
      (file.endsWith('.dmg') || file.endsWith('.zip') || file.includes('-mac'))
    ) {
      artifacts.push(filePath)
    } else if (file.endsWith('.yml')) {
      // Always include yml files
      artifacts.push(filePath)
    }
  }

  return artifacts
}

function uploadToGitHub(artifacts: string[]) {
  const tag = `v${VERSION}`
  const failures: string[] = []

  console.log(`\nUploading ${artifacts.length} artifacts to release ${tag}...`)

  for (const artifact of artifacts) {
    const filename = path.basename(artifact)
    console.log(`  Uploading: ${filename}`)

    try {
      execSync(`gh release upload "${tag}" "${artifact}" --clobber`, {
        stdio: 'inherit',
      })
    } catch (e) {
      console.error(
        `  Failed to upload ${filename}: ${e instanceof Error ? e.message : e}`,
      )
      failures.push(filename)
    }
  }

  if (failures.length > 0) {
    console.error(`\nFailed to upload: ${failures.join(', ')}`)
    process.exit(1)
  }

  console.log('\nUpload complete!')
}

function main() {
  const { publish, platforms } = parseArgs()

  if (!publish) {
    console.log('No --publish flag, skipping upload')
    return
  }

  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.error(
      'Error: GH_TOKEN or GITHUB_TOKEN environment variable required for publishing',
    )
    process.exit(1)
  }

  const artifacts = getArtifacts(platforms)

  if (artifacts.length === 0) {
    console.log('No artifacts found to upload')
    return
  }

  console.log('Found artifacts:')
  for (const a of artifacts) {
    console.log(`  ${path.basename(a)}`)
  }

  uploadToGitHub(artifacts)
}

main()
