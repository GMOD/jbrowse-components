import fs from 'fs'
import path from 'path'
import { Args, Flags } from '@oclif/core'
import decompress from 'decompress'
import JBrowseCommand from '../base'
import fetch from '../fetchWithProxy'

export default class Upgrade extends JBrowseCommand {
  static description = 'Upgrades JBrowse 2 to latest version'

  static examples = [
    '# Upgrades current directory to latest jbrowse release',
    '$ jbrowse upgrade',
    '',
    '# Upgrade jbrowse instance at a specific filesystem path',
    '$ jbrowse upgrade /path/to/jbrowse2/installation',
    '',
    '# Upgrade to a specific tag',
    '$ jbrowse upgrade /path/to/jbrowse2/installation --tag v1.0.0',
    '',
    '# List versions available on github',
    '$ jbrowse upgrade --listVersions',
    '',
    '# Upgrade from a specific URL',
    '$ jbrowse upgrade --url https://sample.com/jbrowse2.zip',
    '',
    '# Get nightly release from main branch',
    '$ jbrowse upgrade --nightly',
  ]

  static args = {
    localPath: Args.string({
      required: false,
      description: 'Location where JBrowse 2 is installed',
      default: '.',
    }),
  }

  static flags = {
    help: Flags.help({ char: 'h' }),
    // will need to account for pagination once there is a lot of releases
    listVersions: Flags.boolean({
      char: 'l',
      description: 'Lists out all versions of JBrowse 2',
    }),
    tag: Flags.string({
      char: 't',
      description:
        'Version of JBrowse 2 to install. Format is v1.0.0.\nDefaults to latest',
    }),
    branch: Flags.string({
      description: 'Download a development build from a named git branch',
    }),
    nightly: Flags.boolean({
      description: 'Download the latest development build from the main branch',
    }),
    clean: Flags.boolean({
      description: 'Removes old js,map,and LICENSE files in the installation',
    }),
    url: Flags.string({
      char: 'u',
      description: 'A direct URL to a JBrowse 2 release',
    }),
  }

  async run() {
    const { args: runArgs, flags: runFlags } = await this.parse(Upgrade)
    const { localPath: argsPath } = runArgs as { localPath: string }
    const { clean, listVersions, tag, url, branch, nightly } = runFlags

    if (listVersions) {
      const versions = (await this.fetchGithubVersions()).map(v => v.tag_name)
      this.log(`All JBrowse versions:\n${versions.join('\n')}`)
      this.exit()
    }

    this.debug(`Want to upgrade at: ${argsPath}`)
    if (!argsPath) {
      this.error('No directory supplied', { exit: 100 })
    }

    if (!fs.existsSync(path.join(argsPath, 'manifest.json'))) {
      this.error(
        `No manifest.json found in this directory, are you sure it is an
        existing jbrowse 2 installation?`,
        { exit: 10 },
      )
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

    if (clean) {
      fs.rmSync(path.join(argsPath, 'static'), { recursive: true, force: true })
      fs.readdirSync(argsPath)
        .filter(f => f.includes('worker.js'))
        .forEach(f => {
          fs.unlinkSync(path.join(argsPath, f))
        })
    }

    await decompress(Buffer.from(await response.arrayBuffer()), argsPath)
    this.log(`Unpacked ${locationUrl} at ${argsPath}`)
  }
}
