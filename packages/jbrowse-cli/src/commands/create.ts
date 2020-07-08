import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import * as unzip from 'unzipper'

export default class Create extends Command {
  static description = 'Downloads and installs the latest Jbrowse 2 release'

  static examples = [
    '$ jbrowse create /path/to/new/installation',
    '$ jbrowse create /path/to/new/installation --force',
    '$ jbrowse create /path/to/new/installation -u url.com/directjbrowselink.zip',
    '$ jbrowse create /path/to/new/installation 0.0.1',
    '$ jbrowse create -l',
  ]

  static args = [
    {
      name: 'localPath',
      required: true,
      description: `Location where JBrowse 2 will be installed`,
    },
    {
      name: 'version',
      required: false,
      description: `Version of JBrowse to download, defaults to latest`,
    },
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    force: flags.boolean({
      char: 'f',
      description:
        'Overwrites existing JBrowse 2 installation if present in path',
    }),
    listVersions: flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    url: flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(Create)
    const { localPath: argsPath } = runArgs as { localPath: string }
    this.debug(`Want to install path at: ${argsPath}`)

    const { force, url } = runFlags
    const { version } = runArgs

    // mkdir will do nothing if dir exists
    try {
      await fsPromises.mkdir(argsPath, { recursive: true })
    } catch (error) {
      this.error(error)
    }

    if (!force) await this.checkPath(argsPath)

    const locationUrl =
      url ||
      `https://s3.amazonaws.com/jbrowse.org/jb2_releases/JBrowse2_version_${
        version || (await this.fetchVersions()).versions[0]
      }.zip`

    let response
    try {
      response = await fetch(locationUrl, {
        method: 'GET',
      })
    } catch (error) {
      this.error(error)
    }
    if (!response.ok)
      this.error(`Failed to fetch JBrowse2 from server`, { exit: 40 })

    if (url && response.headers.get('content-type') !== 'application/zip')
      this.error(
        'The URL provided does not seem to be a JBrowse installation URL',
      )
    let body
    try {
      body = await response.body
    } catch (error) {
      this.error(error)
    }
    body
      .pipe(unzip.Parse())
      .on('entry', async entry => {
        const { path: fileName, type } = entry
        if (type === 'Directory') {
          try {
            await fsPromises.mkdir(path.join(argsPath, fileName), {
              recursive: true,
            })
          } catch (error) {
            this.error(error)
          }
        }
        entry.pipe(fs.createWriteStream(path.join(argsPath, fileName)))
      })
      .on('error', err => {
        fs.unlink(argsPath, () => {})
        this.error(
          `Failed to download JBrowse 2 with ${err}. Please try again later`,
        )
      })
      .on('close', () => {
        this.log(`Your JBrowse 2 setup has been created at ${argsPath}`)
      })
  }

  async checkPath(userPath: string) {
    let allFiles
    try {
      allFiles = await fsPromises.readdir(userPath)
    } catch (error) {
      this.error('Directory does not exist', { exit: 20 })
    }
    if (allFiles.length > 0)
      this.error(
        `${userPath} This directory has existing files and could cause conflicts with create. Please choose another directory or use the force flag to overwrite existing files`,
        { exit: 10 },
      )
  }

  async fetchVersions() {
    let versionResponse
    try {
      versionResponse = await fetch(
        'https://s3.amazonaws.com/jbrowse.org/jb2_releases/versions.json',
        {
          method: 'GET',
        },
      )
    } catch (error) {
      this.error(error)
    }
    if (!versionResponse) {
      this.error(`Failed to fetch version from server`)
    }

    return versionResponse.json()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async catch(error: any) {
    if (error.parse && error.parse.output.flags.listVersions) {
      const res = await this.fetchVersions()
      this.log(`All JBrowse versions: ${res.versions.join(', ')}`)
      this.exit()
    }
    throw error
  }
}
