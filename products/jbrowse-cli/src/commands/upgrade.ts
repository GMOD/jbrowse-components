import { flags } from '@oclif/command'
import fetch from 'node-fetch'
import * as unzip from 'unzipper'
import JBrowseCommand from '../base'

interface GithubRelease {
  tag_name: string
  prerelease: boolean
  assets: [
    {
      browser_download_url: string
    },
  ]
}
export default class Upgrade extends JBrowseCommand {
  static description = 'Upgrades JBrowse 2 to latest version'

  static examples = [
    '$ jbrowse upgrade # Upgrades current directory to latest jbrowse release',
    '$ jbrowse upgrade /path/to/jbrowse2/installation',
    '$ jbrowse upgrade /path/to/jbrowse2/installation --tag @gmod/jbrowse-web@0.0.1',
    '$ jbrowse upgrade --listVersions # Lists out all available versions of JBrowse 2',
    '$ jbrowse upgrade --url https://sample.com/jbrowse2.zip',
  ]

  static args = [
    {
      name: 'localPath',
      required: false,
      description: `Location where JBrowse 2 is installed`,
      default: '.',
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
    // will need to account for pagenation once there is a lot of releases
    listVersions: flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    tag: flags.string({
      char: 't',
      description:
        'Version of JBrowse 2 to install. Format is @gmod/jbrowse-web@0.0.1.\nDefaults to latest',
    }),
    url: flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(Upgrade)
    const { localPath: argsPath } = runArgs as { localPath: string }

    const { listVersions, tag, url } = runFlags

    if (listVersions) {
      try {
        const versions = (await this.fetchGithubVersions()).map(
          version => version.tag_name,
        )
        this.log(`All JBrowse versions: ${versions.join(', ')}`)
        this.exit()
      } catch (error) {
        this.error(error)
      }
    }
    this.debug(`Want to upgrade at: ${argsPath}`)

    await this.checkLocation(argsPath)

    const locationUrl = url || (await this.getTagOrLatest(tag))

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

  async fetchGithubVersions() {
    const response = await fetch(
      'https://api.github.com/repos/GMOD/jbrowse-components/releases',
    )

    if (!response.ok) {
      this.error('Failed to fetch version from server')
    }

    // use all release only if there are only pre-release in repo
    const jb2releases: GithubRelease[] = await response.json()
    const versions = jb2releases.filter(release =>
      release.tag_name.startsWith('@gmod/jbrowse-web'),
    )

    const nonprereleases = versions.filter(
      release => release.prerelease === false,
    )

    return nonprereleases.length === 0 ? jb2releases : nonprereleases
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
          { exit: 110 },
        )
  }
}
