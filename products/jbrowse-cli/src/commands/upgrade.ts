import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

import {
  extractZip,
  fetchGithubVersions,
  fetchReleaseArchive,
  printHelp,
  resolveReleaseUrl,
} from '../utils.ts'

const description = 'Upgrades JBrowse 2 to latest version'

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
  help: {
    type: 'boolean',
    short: 'h',
    description: 'Display help for command',
  },
  // will need to account for pagination once there is a lot of releases
  listVersions: {
    type: 'boolean',
    short: 'l',
    description: 'Lists out all versions of JBrowse 2',
  },
  tag: {
    type: 'string',
    short: 't',
    description:
      'Version of JBrowse 2 to install. Format is v1.0.0. Defaults to latest',
  },
  branch: {
    type: 'string',
    description: 'Download a development build from a named git branch',
  },
  nightly: {
    type: 'boolean',
    description: 'Download the latest development build from the main branch',
  },
  clean: {
    type: 'boolean',
    description: 'Removes old js,map,and LICENSE files in the installation',
  },
  url: {
    type: 'string',
    short: 'u',
    description: 'A direct URL to a JBrowse 2 release',
  },
} as const

export async function run(args: string[]) {
  const { positionals, values: runFlags } = parseArgs({
    options,
    args,
    allowPositionals: true,
  })
  const argsPath = positionals[0]
  const { clean, listVersions, tag, url, branch, nightly } = runFlags
  if (runFlags.help) {
    printHelp({
      options,
      examples,
      usage: 'jbrowse upgrade [localPath] [options]',
      description,
    })
    return
  }

  if (listVersions) {
    const versions = (await fetchGithubVersions()).map(v => v.tag_name)
    console.log(`All JBrowse versions:\n${versions.join('\n')}`)
    process.exit(0)
  }

  if (!argsPath) {
    throw new Error('No directory supplied')
  }

  if (!fs.existsSync(path.join(argsPath, 'manifest.json'))) {
    throw new Error(
      `No manifest.json found in this directory, are you sure it is an
        existing jbrowse 2 installation?`,
    )
  }

  const locationUrl = await resolveReleaseUrl({ url, nightly, branch, tag })
  const archive = await fetchReleaseArchive(locationUrl, !!url)

  if (clean) {
    fs.rmSync(path.join(argsPath, 'static'), { recursive: true, force: true })
    for (const f of fs
      .readdirSync(argsPath)
      .filter(f => f.includes('worker.js'))) {
      fs.unlinkSync(path.join(argsPath, f))
    }
  }

  await extractZip(archive, argsPath)
  console.log(`Unpacked ${locationUrl} at ${argsPath}`)
}
