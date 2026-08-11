import { execSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import { APP_NAME, DIST, ROOT, VERSION } from './config.ts'

import type { ExecSyncOptions } from 'child_process'

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

// For pinned build tools, whose published checksums are hex sha256. (The update
// manifest above wants base64 sha512 — that is electron-updater's format, not a
// preference.)
export function sha256Hex(filePath: string) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex')
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

// The electron-updater feed for one platform: the artifacts a client may
// download, and the hash it checks each against.
//
// A file that isn't there is a build failure, not an entry to leave out. Every
// caller writes its artifact and then immediately describes it here, so a
// missing one cannot happen — but skipping it yielded a manifest that is
// perfectly well-formed and lists nothing, which publish.ts then uploads (it
// checks the artifacts and the manifest exist, not that the manifest mentions
// them) and which answers every client's update check with "no files". That is
// the same silent-shortfall failure the note at the top of artifacts.ts is
// about, one level down.
export function generateLatestYml(files: string[]) {
  const missing = files.filter(f => !fs.existsSync(path.join(DIST, f)))
  if (missing.length > 0) {
    throw new Error(
      `cannot write the update manifest: ${missing.join(', ')} not in ${DIST}`,
    )
  }
  const lines = [`version: ${VERSION}`, `files:`]

  for (const file of files) {
    const filePath = path.join(DIST, file)
    lines.push(`  - url: ${file}`)
    lines.push(`    sha512: ${sha512Base64(filePath)}`)
    lines.push(`    size: ${fileSize(filePath)}`)
  }

  // The pre-`files` fields, still read by older clients. Always the first entry,
  // which is why each caller passes the artifact its platform updates FROM
  // first (mac's zip, not its dmg).
  const first = files[0]
  if (first) {
    lines.push(`path: ${first}`)
    lines.push(`sha512: ${sha512Base64(path.join(DIST, first))}`)
  }

  lines.push(`releaseDate: '${new Date().toISOString()}'`)
  return lines.join('\n')
}
