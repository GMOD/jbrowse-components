import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import extract from 'extract-zip'
import os from 'os'

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
    url: flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
  }

  async getTagOrLatest(tag?: string) {
    const response = await this.fetchGithubVersions()
    const versions = tag
      ? response.find(version => version.tag_name === tag)
      : response[0]

    return versions
      ? versions.assets[0].browser_download_url
      : this.error(
          'Could not find version specified. Use --listVersions to see all available versions',
          { exit: 40 },
        )
  }

  async run() {
    const {
      args,
      flags: { listVersions, tag, url },
    } = this.parse(Upgrade)
    const { localPath } = args as { localPath: string }

    if (listVersions) {
      const releases = await this.fetchGithubVersions()
      const versions = releases.map(release => release.tag_name)
      this.log(`All JBrowse versions: ${versions.join(', ')}`)
      this.exit()
    }

    const upgradePath = localPath || '.'
    this.debug(`Want to upgrade at: ${upgradePath}`)

    await this.checkLocation(upgradePath)
    const locationUrl = url || (await this.getTagOrLatest(tag))
    const response = await fetch(locationUrl)

    if (!response.ok) {
      this.error(
        `Failed to fetch JBrowse2 from server. Error ${response.status}`,
        { exit: 50 },
      )
    }

    if (url && response.headers.get('content-type') !== 'application/zip') {
      this.error(
        'The URL provided does not seem to be a JBrowse installation URL',
      )
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jbrowse-'))
    const file = path.join(tmp, 'jbrowse.zip')
    try {
      await new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(file)
        response.body.pipe(dest)
        dest.on('close', () => {
          resolve()
        })
        dest.on('error', reject)
      })
      await extract(file, { dir: path.resolve(upgradePath) })
    } finally {
      fs.unlinkSync(file)
      fs.rmdirSync(tmp)
    }
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
    const response = await fetch(
      'https://api.github.com/repos/GMOD/jbrowse-components/releases',
    )

    if (!response.ok) {
      this.error('Failed to fetch version from server')
    }
    // use all release only if there are only pre-release in repo
    const releases = (await response.json()) as GithubRelease[]
    const jb2releases = releases.filter(release =>
      release.tag_name.includes('@gmod/jbrowse-web@v'),
    )

    const nonprereleases = jb2releases.filter(
      release => release.prerelease === false,
    )

    return nonprereleases.length === 0 ? jb2releases : nonprereleases
  }
}
