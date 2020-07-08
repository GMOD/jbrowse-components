import { Command, flags } from '@oclif/command'
import * as fs from 'fs'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import * as unzip from 'unzipper'

export default class Create extends Command {
  static description = 'Downloads and installs the latest Jbrowse 2 release'

  static examples = [
    '$ jbrowse create /path/to/new/installation',
    '$ jbrowse create /path/to/new/installation --force',
  ]

  static args = [
    {
      name: 'userPath',
      required: true,
      description: `Location where JBrowse 2 will be installed`,
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

    // mkdir will do nothing if dir exists
    try {
      await fsPromises.mkdir(argsPath, { recursive: true })
    } catch (error) {
      this.error(error)
    }

    this.log('run')
    if (!force) await this.checkPath(argsPath)

    let response
    try {
      response = await fetch(
        'https://s3.amazonaws.com/jbrowse.org/jb2_releases/JBrowse2_PKX_cli_testing.zip',
        {
          method: 'GET',
        },
      )
    } catch (error) {
      this.error(error)
    }
    if (!response.ok) this.error(`Failed to fetch JBrowse2 from server`)

    let body
    try {
      body = await response.body
    } catch (error) {
      this.error(error)
    }
    body
      .pipe(unzip.Parse())
      .on('entry', async entry => {
        const { path: fileName, type } = entry
        if (type === 'Directory') {
          try {
            await fsPromises.mkdir(path.join(argsPath, fileName), {
              recursive: true,
            })
          } catch (error) {
            this.error(error)
          }
        }
        entry.pipe(fs.createWriteStream(path.join(argsPath, fileName)))
      })
      .on('error', err => {
        fs.unlink(argsPath, () => {})
        this.error(
          `Failed to download JBrowse 2 with error: ${err}. Please try again later`,
        )
      })
      .on('close', () => {
        this.log(`Your JBrowse 2 setup has been created at ${argsPath}`)
      })
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
}
