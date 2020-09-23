import { flags } from '@oclif/command'
import fetch from 'node-fetch'
import * as unzip from 'unzipper'
import JBrowseCommand from '../base'

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
      const versions = (await this.fetchGithubVersions()).map(
        version => version.tag_name,
      )
      this.log(`All JBrowse versions:\n${versions.join('\n')}`)
      this.exit()
    }
    this.debug(`Want to upgrade at: ${argsPath}`)

    await this.checkLocation(argsPath)

    const locationUrl =
      url || (tag ? await this.getTag(tag) : await this.getLatest())

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
}
