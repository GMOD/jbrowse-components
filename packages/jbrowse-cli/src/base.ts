import Command from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

export default abstract class JBrowseCommand extends Command {
  async init() {
    // const { flags } = this.parse(JBrowseCommand)
    // this.flags = flags
  }

  async checkLocation(location = '.') {
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile(
        path.join(location, 'manifest.json'),
        {
          encoding: 'utf8',
        },
      )
    } catch (error) {
      this.error(
        'Could not find the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 50 },
      )
    }
    let manifest: { name?: string } = {}
    try {
      manifest = JSON.parse(manifestJson)
    } catch (error) {
      this.error(
        'Could not parse the file "manifest.json". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 60 },
      )
    }
    if (manifest.name !== 'JBrowse') {
      this.error(
        '"name" in file "manifest.json" is not "JBrowse". Please make sure you are in the top level of a JBrowse 2 installation.',
        { exit: 70 },
      )
    }
  }

  async readJsonConfig(location: string) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      const response = await fetch(locationUrl)
      return response.json()
    }
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }

  // async resolveFileLocation(location: string, check = true) {
  //   let locationUrl: URL | undefined
  //   let locationPath: string | undefined
  //   try {
  //     locationUrl = new URL(location)
  //   } catch (error) {
  //     // ignore
  //   }
  //   if (locationUrl) {
  //     let response
  //     try {
  //       if (check) {
  //         response = await fetch(locationUrl, { method: 'HEAD' })
  //         if (response.ok) {
  //           return locationUrl.href
  //         }
  //       } else {
  //         return locationUrl.href
  //       }
  //     } catch (error) {
  //       // ignore
  //     }
  //   }
  //   try {
  //     if (check) {
  //       locationPath = await fsPromises.realpath(location)
  //     } else {
  //       locationPath = location
  //     }
  //   } catch (e) {
  //     // ignore
  //   }
  //   if (locationPath) {
  //     const filePath = path.relative(process.cwd(), locationPath)
  //     return filePath
  //   }
  //   return this.error(`Could not resolve to a file or a URL: "${location}"`, {
  //     exit: 90,
  //   })
  // }
}
