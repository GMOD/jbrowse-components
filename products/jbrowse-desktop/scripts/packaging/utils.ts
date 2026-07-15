import { execSync, type ExecSyncOptions } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import { APP_NAME, DIST, ROOT, VERSION } from './config.ts'

export function log(msg: string) {
  console.log(`\n→ ${msg}`)
}

export function run(cmd: string, opts: ExecSyncOptions = {}) {
  console.log(`  $ ${cmd.length > 100 ? cmd.slice(0, 100) + '...' : cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts })
}

export function runQuiet(cmd: string) {
  return execSync(cmd, { encoding: 'utf8', cwd: ROOT }).trim()
}

export function sha512Base64(filePath: string) {
  const hash = crypto.createHash('sha512')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('base64')
}

export function fileSize(filePath: string) {
  return fs.statSync(filePath).size
}

export function fileSizeMB(filePath: string) {
  const size = fileSize(filePath)
  return size > 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${(size / 1024).toFixed(1)} KB`
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

export function generateAppUpdateYml() {
  return `provider: github
owner: GMOD
repo: jbrowse-components
updaterCacheDirName: ${APP_NAME}-updater
`
}

export function generateLatestYml(files: string[]) {
  const lines = [`version: ${VERSION}`, `files:`]
  const first = files[0]

  for (const file of files) {
    const filePath = path.join(DIST, file)
    if (fs.existsSync(filePath)) {
      lines.push(`  - url: ${file}`)
      lines.push(`    sha512: ${sha512Base64(filePath)}`)
      lines.push(`    size: ${fileSize(filePath)}`)
    }
  }

  if (first) {
    const firstPath = path.join(DIST, first)
    if (fs.existsSync(firstPath)) {
      lines.push(`path: ${first}`)
      lines.push(`sha512: ${sha512Base64(firstPath)}`)
    }
  }

  lines.push(`releaseDate: '${new Date().toISOString()}'`)
  return lines.join('\n')
}
