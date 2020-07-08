import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import * as unzip from 'unzipper'

export default class Upgrade extends Command {
  static description = 'Upgrades JBrowse 2 to latest version'

  static examples = [
    '$ jbrowse upgrade',
    '$ jbrowse upgrade /path/to/jbrowse2/installation',
    '$ jbrowse upgrade -l',
  ]

  static args = [
    {
      name: 'localPath',
      required: false,
      description: `Location where JBrowse 2 is installed`,
    },
    {
      name: 'placeholder',
      required: false,
      description: `Placeholder for config file migration scripts`,
      hidden: true,
    },
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    latestVersion: flags.boolean({
      char: 'l',
      description: 'Displays the latest JBrowse 2 version',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(Upgrade)
    const { localPath: argsPath } = runArgs as { localPath: string }

    if (runFlags.latestVersion) {
      try {
        const logLatest = await this.fetchLatestVersion()
        this.log(logLatest)
        this.exit()
      } catch (error) {
        this.error(error)
      }
    }
    const upgradePath = argsPath || '.'
    this.debug(`Want to upgrade at: ${upgradePath}`)

    await this.checkLocation(upgradePath)

    let latestVersion
    try {
      latestVersion = await this.fetchLatestVersion()
    } catch (error) {
      this.error(error)
    }

    let response
    try {
      response = await fetch(
        `https://s3.amazonaws.com/jbrowse.org/jb2_releases/JBrowse2_version_${latestVersion}.zip`,
        {
          method: 'GET',
        },
      )
    } catch (error) {
      this.error(error)
    }
    if (!response.ok) this.error(`Failed to fetch JBrowse2 from server`)

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
            await fsPromises.mkdir(path.join(upgradePath, fileName), {
              recursive: true,
            })
          } catch (error) {
            this.error(error)
          }
        }
        entry.pipe(fs.createWriteStream(path.join(upgradePath, fileName)))
      })
      .on('error', err => {
        this.error(
          `Failed to upgrade JBrowse 2 with ${err}. Please try again later`,
        )
      })
      .on('close', () => {
        this.log(`Your JBrowse 2 setup has been upgraded`)
      })
  }

  async checkLocation(userPath: string) {
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile(
        path.join(userPath, 'manifest.json'),
        {
          encoding: 'utf8',
        },
      )
    } catch (error) {
      this.error(
        'Could not find the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation or provide the path to one.',
        { exit: 10 },
      )
    }

    let manifest: { name?: string } = {}
    try {
      manifest = JSON.parse(manifestJson)
    } catch (error) {
      this.error(
        'Could not parse the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation or provide the path to one.',
        { exit: 20 },
      )
    }
    if (manifest.name !== 'JBrowse') {
      this.error(
        '"name" in file "manifest.json" is not "JBrowse". Please make sure you are in the top level of a JBrowse 2 installation or provide the path to one.',
        { exit: 30 },
      )
    }
  }

  async fetchLatestVersion() {
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
      this.error(`Failed to fetch JBrowse versions from server`)
    }

    try {
      const res = await versionResponse.json()
      return res.versions[0]
    } catch (error) {
      return error
    }
  }
}
