/* eslint curly:error */
import { flags } from '@oclif/command'
import fs from 'fs'
import fetch from 'node-fetch'
import unzip from 'unzipper'
import JBrowseCommand from '../base'

const fsPromises = fs.promises

export default class Create extends JBrowseCommand {
  static description = 'Downloads and installs the latest JBrowse 2 release'

  static examples = [
    '$ jbrowse create /path/to/new/installation',
    '$ jbrowse create /path/to/new/installation --force',
    '$ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip',
    '$ jbrowse create /path/to/new/installation --tag v1.0.0',
    '$ jbrowse create --listVersions # Lists out all available versions of JBrowse 2',
  ]

  static args = [
    {
      name: 'localPath',
      required: true,
      description: `Location where JBrowse 2 will be installed`,
    },
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    force: flags.boolean({
      char: 'f',
      description:
        'Overwrites existing JBrowse 2 installation if present in path',
    }),
    // will need to account for pagenation once there is a lot of releases
    listVersions: flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    branch: flags.string({
      description: 'Download a development build from a named git branch',
    }),
    nightly: flags.boolean({
      description: 'Download the latest development build from the main branch',
    }),
    url: flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
    tag: flags.string({
      char: 't',
      description:
        'Version of JBrowse 2 to install. Format is v1.0.0.\nDefaults to latest',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(Create)
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

    await response.body.pipe(unzip.Extract({ path: argsPath })).promise()
    this.log(`Unpacked ${locationUrl} at ${argsPath}`)
  }

  async checkPath(userPath: string) {
    const allFiles = await fsPromises.readdir(userPath)
    if (allFiles.length > 0) {
      this.error(
        `${userPath} This directory has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
        { exit: 120 },
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async catch(error: any) {
    if (error.parse && error.parse.output.flags.listVersions) {
      const versions = (await this.fetchGithubVersions()).map(
        version => version.tag_name,
      )
      this.log(`All JBrowse versions:\n${versions.join('\n')}`)
      this.exit()
    }
    throw error
  }
}
