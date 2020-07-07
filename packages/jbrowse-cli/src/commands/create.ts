import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import { inflate, deflate } from 'pako'

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
    if (!force) await this.checkPath(argsPath)

    // download the zipped file to path given
    // fs should overwrite on default
    const zipLocation = path.join(argsPath, 'JBrowse2.zip')
    const fileStream = fs.createWriteStream(zipLocation)
    await fetch(
      'https://s3.amazonaws.com/jbrowse.org/jb2_releases/JBrowse2_PKX_cli_testing.zip',
      {
        method: 'GET',
      },
    )
      .then(res => res.body)
      .then(body => {
        body.pipe(fileStream)
        fileStream.on('error', err => {
          fs.unlink(argsPath, () => {})
          this.error(
            `Failed to download JBrowse 2 with error: ${err}. Please try again later`,
          )
        })
        fileStream.on('finish', () => fileStream.close())
      })
      .catch(err =>
        this.error(
          `Failed to download JBrowse 2 with error: ${err}. Please try again later`,
        ),
      )

    const fileRead = await fsPromises
      .readFile(zipLocation)
      .then(file => inflate(file)) // inflate causing a buffer error
      .catch(err => this.error(`Could not unzip files with ${err}`))

    // if(forceFlag && !pathIsEmpty) will need to overwrite any files that conflict
    // with new isntallation
  }

  async checkPath(userPath: string) {
    const pathExists = await fs.existsSync(userPath)
    if (pathExists) {
      const allFiles = await fsPromises.readdir(userPath)
      if (allFiles.length > 0)
        this.error(
          `This directory has existing files and could cause conflicts with create. 
          Please choose another directory or use the force flag to overwrite existing files`,
          { exit: 10 },
        )
    } else await fsPromises.mkdir(userPath, { recursive: true })
  }
}
