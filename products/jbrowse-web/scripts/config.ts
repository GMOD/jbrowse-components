import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

import type { Configuration } from 'webpack'

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return undefined
  }
}

export default function webpackConfig(config: Configuration) {
  const hash = getGitHash()
  writeFileSync(
    resolve(process.cwd(), 'src/buildInfo.ts'),
    hash
      ? `export const gitCommit = '${hash}'\n`
      : `export const gitCommit: string | undefined = undefined\n`,
  )
  return config
}
