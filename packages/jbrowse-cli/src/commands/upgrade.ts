import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

interface UriLocation {
  uri: string
}

export default class Upgrade extends Command {
  static description = 'Upgrades Jbrowse 2 to latest version'

  static examples = ['$ jbrowse upgrade /path/to/new/installation']

  static args = [
    {
      name: 'path',
      required: true,
      description: `Location where jbrowse 2 will be installed`,
    },
    {
      name: 'placeholder',
      required: false,
      description: `Placeholder for config file migration scripts`,
    },
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
  }

  async run() {
    // similar to create but with no force flag
    // will just auto overwrite any conflicting files because it is an upgrade
    // probably need to check if there is a jbrowse to upgrade
    // if not its a create rather than an upgrade
  }
}
