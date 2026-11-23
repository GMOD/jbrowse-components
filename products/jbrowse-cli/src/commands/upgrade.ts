import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  installRelease,
  printHelp,
  printVersions,
  releaseOptions,
} from '../utils.ts'

const description =
  "Upgrades JBrowse 2 to the newest release of this CLI's major version"

const examples = [
  '# Upgrades current directory to latest jbrowse release',
  '$ jbrowse upgrade',
  '',
  '# Upgrade jbrowse instance at a specific filesystem path',
  '$ jbrowse upgrade /path/to/jbrowse2/installation',
  '',
  '# Upgrade to a specific tag',
  '$ jbrowse upgrade /path/to/jbrowse2/installation --tag v1.0.0',
  '',
  '# List versions available on github',
  '$ jbrowse upgrade --listVersions',
  '',
  '# Upgrade from a specific URL',
  '$ jbrowse upgrade --url https://sample.com/jbrowse2.zip',
  '',
  '# Get nightly release from main branch',
  '$ jbrowse upgrade --nightly',
]

const options = {
  ...releaseOptions,
  clean: {
    type: 'boolean',
    description:
      "Removes the installation's static directory and its *worker.js files before unpacking the new release, so files the new release no longer ships do not linger",
  },
} as const

export async function run(args: string[]) {
  const { positionals, values: runFlags } = parseArgs({
    options,
    args,
    allowPositionals: true,
  })
  if (runFlags.help) {
    printHelp({
      options,
      examples,
      usage: 'jbrowse upgrade [localPath] [options]',
      description,
    })
    return
  }

  if (runFlags.listVersions) {
    await printVersions()
    return
  }

  // localPath is optional: `jbrowse upgrade` upgrades the install in the
  // current directory, as the examples and docs advertise
  const argsPath = positionals[0] ?? '.'

  if (!fs.existsSync(path.join(argsPath, 'manifest.json'))) {
    throw new Error(
      `No manifest.json found in this directory, are you sure it is an
        existing jbrowse 2 installation?`,
    )
  }

  await installRelease(runFlags, argsPath, () => {
    if (runFlags.clean) {
      fs.rmSync(path.join(argsPath, 'static'), { recursive: true, force: true })
      for (const f of fs.readdirSync(argsPath)) {
        if (f.includes('worker.js')) {
          fs.unlinkSync(path.join(argsPath, f))
        }
      }
    }
  })
}
