import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

interface UriLocation {
  uri: string
}

export default class Create extends Command {
  static description = 'Downloads and installs the latest Jbrowse 2 release'

  static examples = [
    '$ jbrowse create /path/to/new/installation',
    '$ jbrowse create /path/to/new/installation -force',
  ]

  static args = [
    {
      name: 'path',
      required: true,
      description: `Location where jbrowse 2 will be installed`,
    },
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    force: flags.boolean({
      char: 'f',
      description:
        'Overwrites existing jbrowse installation if present in path',
    }),
  }

  async run() {
    // get path from args, force from flags
    // if(!pathIsEmpty)
    //  if(!noForceFlag) write error message saying there is existing files, and return
    // else if force flag or path is empty, run rest of code
    // download from s3 bucket the zipped jbrowse 2
    // unzip in the path provided
    // if(forceFlag && !pathIsEmpty) will need to overwrite any files that conflict
    // with new isntallation
  }
}
