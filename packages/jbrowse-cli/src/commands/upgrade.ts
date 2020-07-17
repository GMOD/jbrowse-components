import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import * as unzip from 'unzipper'

interface GithubRelease {
  tag_name: string
  prerelease: boolean
  assets: [
    {
      browser_download_url: string
    },
  ]
}
export default class Upgrade extends Command {
  static description = 'Upgrades JBrowse 2 to latest version'

  static examples = [
    '$ jbrowse upgrade',
    '$ jbrowse upgrade /path/to/jbrowse2/installation',
    '$ jbrowse upgrade /path/to/jbrowse2/installation --tag @gmod/jbrowse-web@v0.0.1',
    '$ jbrowse upgrade --listVersions',
  ]

  static args = [
    {
      name: 'localPath',
      required: false,
      description: `Location where JBrowse 2 is installed. Defaults to .`,
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
    listVersions: flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    tag: flags.string({
      char: 't',
      description: 'Version of JBrowse 2 to upgrade to. Defaults to latest',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(Upgrade)
    const { localPath: argsPath } = runArgs as { localPath: string }

    const { listVersions, tag } = runFlags

    if (listVersions) {
      try {
        const versions = (await this.fetchGithubVersions()).map(
          (version: GithubRelease) => version.tag_name,
        )
        this.log(`All JBrowse versions: ${versions.join(', ')}`)
        this.exit()
      } catch (error) {
        this.error(error)
      }
    }
    const upgradePath = argsPath || '.'
    this.debug(`Want to upgrade at: ${upgradePath}`)

    await this.checkLocation(upgradePath)

    let versionRes
    try {
      versionRes = await this.fetchGithubVersions()
    } catch (error) {
      this.error(error)
    }
    const versionObj = tag
      ? versionRes.find((version: GithubRelease) => version.tag_name === tag)
      : versionRes[0]

    const locationUrl = versionObj
      ? versionObj.assets[0].browser_download_url
      : this.error(
          'Could not find version specified. Use --listVersions to see all available versions',
          { exit: 40 },
        )

    let response
    try {
      response = await fetch(locationUrl, {
        method: 'GET',
      })
    } catch (error) {
      this.error(error)
    }
    if (!response.ok) this.error(`Failed to fetch JBrowse2 from server`)

    response.body
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

  async fetchGithubVersions() {
    let versionResponse
    try {
      versionResponse = await fetch(
        'https://api.github.com/repos/GMOD/jbrowse-components/releases',
        {
          method: 'GET',
        },
      )
    } catch (error) {
      this.error(error)
    }

    if (!versionResponse.ok) this.error('Failed to fetch version from server')
    // use all release only if there are only pre-release in repo
    const allReleaseArray = (
      await versionResponse.json()
    ).filter((release: GithubRelease) =>
      release.tag_name.includes('@gmod/jbrowse-web@v'),
    )

    const releaseArray = allReleaseArray.filter(
      (release: GithubRelease) => release.prerelease === false,
    )

    return releaseArray.length === 0 ? allReleaseArray : releaseArray
  }
}
