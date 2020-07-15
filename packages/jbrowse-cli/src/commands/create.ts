import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
// @ts-ignore says it needs esModuleInterop
import extract from 'extract-zip'

interface GithubRelease {
  tag_name: string
  prerelease: boolean
  assets: [
    {
      browser_download_url: string
    },
  ]
}
export default class Create extends Command {
  static description = 'Downloads and installs the latest JBrowse 2 release'

  static examples = [
    '$ jbrowse create /path/to/new/installation',
    '$ jbrowse create /path/to/new/installation --force',
    '$ jbrowse create /path/to/new/installation --url url.com/directjbrowselink.zip',
    '$ jbrowse create /path/to/new/installation --tag JBrowse-2@v0.0.1',
    '$ jbrowse create --listVersion',
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
    listVersions: flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    url: flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
    tag: flags.string({
      char: 't',
      description:
        'Version of JBrowse 2 to install. Format is JBrowse-2@v1.2.3. Defaults to latest',
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
      flags: { force, url, listVersions, tag },
    } = this.parse(Create)
    const { localPath } = args as { localPath: string }
    this.debug(`Want to install path at: ${localPath}`)

    if (listVersions) {
      const releases = await this.fetchGithubVersions()
      const versions = releases.map(release => release.tag_name)
      this.log(`All JBrowse versions: ${versions.join(', ')}`)
      this.exit()
    }

    fs.mkdirSync(localPath, { recursive: true })
    if (!force) {
      await this.checkPath(localPath)
    }

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
    await new Promise((resolve, reject) => {
      const dest = fs.createWriteStream('tmp.zip')
      response.body.pipe(dest)
      dest.on('close', () => resolve())
      dest.on('error', reject)
    })
    return extract('tmp.zip', { dir: path.resolve(localPath) })
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
      release.tag_name.includes('JBrowse-2@v'),
    )

    const nonprereleases = jb2releases.filter(
      release => release.prerelease === false,
    )

    return nonprereleases.length === 0 ? jb2releases : nonprereleases
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async catch(error: any) {
    if (error.parse && error.parse.output.flags.listVersions) {
      const releases = await this.fetchGithubVersions()
      const versions = releases.map(version => version.tag_name)
      this.log(`All JBrowse versions: ${versions.join(', ')}`)
      this.exit()
    }
    throw error
  }
}
