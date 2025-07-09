import fs from 'fs'
import { parseArgs } from 'util'

import decompress from 'decompress'

import fetch from '../fetchWithProxy'
import NativeCommand from '../native-base'

const fsPromises = fs.promises

export default class CreateNative extends NativeCommand {
  static description = 'Downloads and installs the latest JBrowse 2 release'

  static examples = [
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

  async run() {
    const { values: flags, positionals } = parseArgs({
      args: process.argv.slice(3), // Skip node, script, and command name
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        force: {
          type: 'boolean',
          short: 'f',
          default: false,
        },
        listVersions: {
          type: 'boolean',
          short: 'l',
          default: false,
        },
        branch: {
          type: 'string',
        },
        nightly: {
          type: 'boolean',
          default: false,
        },
        url: {
          type: 'string',
          short: 'u',
        },
        tag: {
          type: 'string',
          short: 't',
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
      return
    }

    if (flags.listVersions) {
      const versions = (await this.fetchGithubVersions()).map(
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

    this.debug(`Want to install path at: ${localPath}`)

    // mkdir will do nothing if dir exists
    await fsPromises.mkdir(localPath, { recursive: true })

    if (!flags.force) {
      await this.checkPath(localPath)
    }

    const locationUrl =
      flags.url ||
      (flags.nightly ? await this.getBranch('main') : '') ||
      (flags.branch ? await this.getBranch(flags.branch) : '') ||
      (flags.tag ? await this.getTag(flags.tag) : await this.getLatest())

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

  async checkPath(userPath: string) {
    const allFiles = await fsPromises.readdir(userPath)
    if (allFiles.length > 0) {
      console.error(
        `This directory (${userPath}) has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
      )
      process.exit(120)
    }
  }

  showHelp() {
    console.log(`
${CreateNative.description}

USAGE
  $ jbrowse create <localPath> [options]

ARGUMENTS
  localPath  Location where JBrowse 2 will be installed

OPTIONS
  -h, --help         Show help
  -f, --force        Overwrites existing JBrowse 2 installation if present in path
  -l, --listVersions Lists out all versions of JBrowse 2
  --branch <branch>  Download a development build from a named git branch
  --nightly          Download the latest development build from the main branch
  -u, --url <url>    A direct URL to a JBrowse 2 release
  -t, --tag <tag>    Version of JBrowse 2 to install. Format is v1.0.0. Defaults to latest

EXAMPLES
${CreateNative.examples.join('\n')}
`)
  }
}