import fs from 'fs'
import { parseArgs } from 'util'

import {
  extractZip,
  fetchGithubVersions,
  fetchReleaseArchive,
  printHelp,
  resolveReleaseUrl,
} from '../utils.ts'

const fsPromises = fs.promises

const description = 'Downloads and installs the latest JBrowse 2 release'

const examples = [
  '# Download latest release from github, and put in specific path',
  '$ jbrowse create /path/to/new/installation',
  '',
  '# Download latest release from github and force overwrite existing contents at path',
  '$ jbrowse create /path/to/new/installation --force',
  '',
  '# Download latest release from a specific URL',
  '$ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip',
  '',
  '# Download a specific tag from github',
  '$ jbrowse create /path/to/new/installation --tag v1.0.0',
  '',
  '# List available versions',
  '$ jbrowse create --listVersions',
]

const options = {
  help: {
    type: 'boolean',
    short: 'h',
    description: 'Show help',
  },
  force: {
    type: 'boolean',
    short: 'f',
    description:
      'Overwrites existing JBrowse 2 installation if present in path',
  },
  listVersions: {
    type: 'boolean',
    short: 'l',
    description: 'Lists out all versions of JBrowse 2',
  },
  branch: {
    type: 'string',
    description: 'Download a development build from a named git branch',
  },
  nightly: {
    type: 'boolean',
    description: 'Download the latest development build from the main branch',
  },
  url: {
    type: 'string',
    short: 'u',
    description: 'A direct URL to a JBrowse 2 release',
  },
  tag: {
    type: 'string',
    short: 't',
    description:
      'Version of JBrowse 2 to install. Format is v1.0.0. Defaults to latest',
  },
} as const

export async function run(args: string[]) {
  const { positionals, values: runFlags } = parseArgs({
    options,
    allowPositionals: true,
    args,
  })

  if (runFlags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse create [localPath] [options]',
      options,
    })
    return
  }

  const { force, url, listVersions, tag, branch, nightly } = runFlags
  if (listVersions) {
    const versions = (await fetchGithubVersions()).map(
      version => version.tag_name,
    )
    console.log(`All JBrowse versions:\n${versions.join('\n')}`)
    process.exit(0)
  }

  const argsPath = positionals[0]
  if (!argsPath) {
    throw new Error(
      'Missing 1 required arg:\nlocalPath  Location where JBrowse 2 will be installed\nSee more help with --help',
    )
  }

  // mkdir will do nothing if dir exists
  await fsPromises.mkdir(argsPath, { recursive: true })

  if (!force) {
    await checkPath(argsPath)
  }

  const locationUrl = await resolveReleaseUrl({ url, nightly, branch, tag })
  const archive = await fetchReleaseArchive(locationUrl, !!url)
  await extractZip(archive, argsPath)

  console.log(`Unpacked ${locationUrl} at ${argsPath}`)
}

async function checkPath(userPath: string) {
  const allFiles = await fsPromises.readdir(userPath)
  if (allFiles.length > 0) {
    throw new Error(
      `This directory (${userPath}) has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
    )
  }
}
