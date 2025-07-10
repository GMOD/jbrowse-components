import fs from 'fs'
import { parseArgs } from 'util'

import decompress from 'decompress'

import {
  debug,
  fetchGithubVersions,
  getBranch,
  getTag,
  getLatest,
  printHelp,
} from '../utils'

const fsPromises = fs.promises

async function checkPath(userPath: string) {
  const allFiles = await fsPromises.readdir(userPath)
  if (allFiles.length > 0) {
    console.error(
      `This directory (${userPath}) has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
    )
    process.exit(120)
  }
}

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
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
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

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

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse create <localPath> [options]',
      options,
    })
    return
  }

  if (flags.listVersions) {
    const versions = (await fetchGithubVersions()).map(
      version => version.tag_name,
    )
    console.log(`All JBrowse versions:\n${versions.join('\n')}`)
    process.exit(0)
  }

  const localPath = positionals[0]
  if (!localPath) {
    console.error('Missing 1 required arg:')
    console.error('localPath  Location where JBrowse 2 will be installed')
    console.error('See more help with --help')
    process.exit(1)
  }

  debug(`Want to install path at: ${localPath}`)

  // mkdir will do nothing if dir exists
  await fsPromises.mkdir(localPath, { recursive: true })

  if (!flags.force) {
    await checkPath(localPath)
  }

  const locationUrl =
    flags.url ||
    (flags.nightly ? await getBranch('main') : '') ||
    (flags.branch ? await getBranch(flags.branch) : '') ||
    (flags.tag ? await getTag(flags.tag) : await getLatest())

  console.log(`Fetching ${locationUrl}...`)
  const response = await fetch(locationUrl)
  if (!response.ok) {
    console.error(`Failed to fetch: ${response.statusText}`)
    process.exit(100)
  }

  const type = response.headers.get('content-type')
  if (
    flags.url &&
    type !== 'application/zip' &&
    type !== 'application/octet-stream'
  ) {
    console.error(
      'The URL provided does not seem to be a JBrowse installation URL',
    )
    process.exit(1)
  }
  await decompress(Buffer.from(await response.arrayBuffer()), localPath)

  console.log(`Unpacked ${locationUrl} at ${localPath}`)
}
