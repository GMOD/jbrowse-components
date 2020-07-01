import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
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
      name: 'userPath',
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
    const { args: runArgs, flags: runFlags } = this.parse(Create)
    const { userPath: argsPath } = runArgs as { userPath: string }
    this.debug(`Want to install path at: ${argsPath}`)

    const { force } = runFlags
    if (!force) await this.checkPath(JSON.stringify(argsPath))
    // get path from args, force from flags
    // if(!pathIsEmpty)
    //  if(!noForceFlag) write error message saying there is existing files, and return
    // else if force flag or path is empty, run rest of code
    // download from s3 bucket the zipped jbrowse 2
    // unzip in the path provided
    // if(forceFlag && !pathIsEmpty) will need to overwrite any files that conflict
    // with new isntallation
  }

  async checkPath(userPath: string) {
    const pathExists = await fs.existsSync(userPath)
    if (pathExists) {
      fsPromises.readdir(userPath).then(files => {
        return files.length === 0
          ? true
          : this.error(
              `This directory has existing files and could cause conflicts with create. 
              Please choose another directory or use the force flag to overwrite existing files`,
            )
      })
    }
    return pathExists
  }
}
