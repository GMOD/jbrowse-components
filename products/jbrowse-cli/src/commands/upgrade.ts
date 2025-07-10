import fs from 'fs'
import path from 'path'
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

async function cleanOldFiles(installPath: string) {
  const filesToClean = [
    'static/js',
    'static/css',
    'static/media',
    'LICENSE',
    'manifest.json',
    'asset-manifest.json',
  ]

  for (const file of filesToClean) {
    const fullPath = path.join(installPath, file)
    if (fs.existsSync(fullPath)) {
      debug(`Removing ${fullPath}`)
      try {
        if (fs.lstatSync(fullPath).isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true })
        } else {
          fs.unlinkSync(fullPath)
        }
      } catch (error) {
        console.warn(`Warning: Could not remove ${fullPath}: ${error}`)
      }
    }
  }

  // Clean any .js.map files
  const staticDir = path.join(installPath, 'static')
  if (fs.existsSync(staticDir)) {
    const cleanMapFiles = (dir: string) => {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const fullPath = path.join(dir, file)
        if (fs.lstatSync(fullPath).isDirectory()) {
          cleanMapFiles(fullPath)
        } else if (file.endsWith('.map')) {
          debug(`Removing ${fullPath}`)
          try {
            fs.unlinkSync(fullPath)
          } catch (error) {
            console.warn(`Warning: Could not remove ${fullPath}: ${error}`)
          }
        }
      }
    }
    cleanMapFiles(staticDir)
  }
}

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
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
      description: 'Removes old js, map, and LICENSE files in the installation',
    },
    url: {
      type: 'string',
      short: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

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

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse upgrade [localPath] [options]',
      options,
    })
    return
  }

  const { clean, listVersions, tag, url, branch, nightly } = flags
  const localPath = positionals[0] || '.'

  if (listVersions) {
    const versions = (await fetchGithubVersions()).map(v => v.tag_name)
    console.log(`All JBrowse versions:\n${versions.join('\n')}`)
    process.exit(0)
  }

  debug(`Want to upgrade at: ${localPath}`)

  if (!localPath) {
    console.error('Error: No installation path provided')
    process.exit(1)
  }

  if (!fs.existsSync(localPath)) {
    console.error(`Error: Path ${localPath} does not exist`)
    process.exit(1)
  }

  const isDir = fs.lstatSync(localPath).isDirectory()
  if (!isDir) {
    console.error(`Error: ${localPath} is not a directory`)
    process.exit(1)
  }

  // Check if this looks like a JBrowse installation
  const indexPath = path.join(localPath, 'index.html')
  if (!fs.existsSync(indexPath)) {
    console.warn(
      `Warning: ${localPath} doesn't appear to be a JBrowse installation (no index.html found)`,
    )
  }

  const locationUrl =
    url ||
    (nightly ? await getBranch('main') : '') ||
    (branch ? await getBranch(branch) : '') ||
    (tag ? await getTag(tag) : await getLatest())

  console.log(`Fetching ${locationUrl}...`)
  const response = await fetch(locationUrl)
  if (!response.ok) {
    console.error(`Error: Failed to fetch: ${response.statusText}`)
    process.exit(100)
  }

  const type = response.headers.get('content-type')
  if (
    url &&
    type !== 'application/zip' &&
    type !== 'application/octet-stream'
  ) {
    console.error(
      'Error: The URL provided does not seem to be a JBrowse installation URL',
    )
    process.exit(1)
  }

  // Clean old files if requested
  if (clean) {
    console.log('Cleaning old files...')
    await cleanOldFiles(localPath)
  }

  // Extract the new version
  console.log(`Extracting to ${localPath}...`)
  await decompress(Buffer.from(await response.arrayBuffer()), localPath)

  console.log(`Successfully upgraded JBrowse at ${localPath}`)
}
