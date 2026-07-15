import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return undefined
  }
}

export function genBuildInfo() {
  const hash = getGitHash()
  writeFileSync(
    resolve(import.meta.dirname, '../src/buildInfo.ts'),
    hash
      ? `export const gitCommit = '${hash}'\n`
      : `export const gitCommit: string | undefined = undefined\n`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  genBuildInfo()
}
