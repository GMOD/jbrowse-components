import fs from 'fs'
import { Args, Flags } from '@oclif/core'
import decompress from 'decompress'
import JBrowseCommand from '../base'
import fetch from '../fetchWithProxy'

const fsPromises = fs.promises

export default class Create extends JBrowseCommand {
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

  static args = {
    localPath: Args.string({
      required: true,
      description: 'Location where JBrowse 2 will be installed',
    }),
  }

  static flags = {
    help: Flags.help({ char: 'h' }),
    force: Flags.boolean({
      char: 'f',
      description:
        'Overwrites existing JBrowse 2 installation if present in path',
    }),
    // will need to account for pagination once there is a lot of releases
    listVersions: Flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    branch: Flags.string({
      description: 'Download a development build from a named git branch',
    }),
    nightly: Flags.boolean({
      description: 'Download the latest development build from the main branch',
    }),
    url: Flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
    tag: Flags.string({
      char: 't',
      description:
        'Version of JBrowse 2 to install. Format is v1.0.0.\nDefaults to latest',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = await this.parse(Create)
    const { localPath: argsPath } = runArgs as { localPath: string }
    this.debug(`Want to install path at: ${argsPath}`)

    const { force, url, listVersions, tag, branch, nightly } = runFlags

    if (listVersions) {
      const versions = (await this.fetchGithubVersions()).map(
        version => version.tag_name,
      )
      this.log(`All JBrowse versions:\n${versions.join('\n')}`)
      this.exit()
    }

    // mkdir will do nothing if dir exists
    await fsPromises.mkdir(argsPath, { recursive: true })

    if (!force) {
      await this.checkPath(argsPath)
    }

    const locationUrl =
      url ||
      (nightly ? await this.getBranch('main') : '') ||
      (branch ? await this.getBranch(branch) : '') ||
      (tag ? await this.getTag(tag) : await this.getLatest())

    this.log(`Fetching ${locationUrl}...`)
    const response = await fetch(locationUrl)
    if (!response.ok) {
      this.error(`Failed to fetch: ${response.statusText}`, { exit: 100 })
    }

    const type = response.headers.get('content-type')
    if (
      url &&
      type !== 'application/zip' &&
      type !== 'application/octet-stream'
    ) {
      this.error(
        'The URL provided does not seem to be a JBrowse installation URL',
      )
    }
    await decompress(Buffer.from(await response.arrayBuffer()), argsPath)

    this.log(`Unpacked ${locationUrl} at ${argsPath}`)
  }

  async checkPath(userPath: string) {
    const allFiles = await fsPromises.readdir(userPath)
    if (allFiles.length > 0) {
      this.error(
        `This directory (${userPath}) has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
        { exit: 120 },
      )
    }
  }

  async catch(error: unknown) {
    // @ts-expect-error
    if (error.parse?.output.flags.listVersions) {
      const versions = (await this.fetchGithubVersions()).map(
        version => version.tag_name,
      )
      this.log(`All JBrowse versions:\n${versions.join('\n')}`)
      this.exit()
    }
    throw error
  }
}
