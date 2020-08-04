import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

export default class AddTrackJson extends Command {
  static description =
    'Add a track configuration directly from a JSON hunk to the JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-track-json track.json',
    '$ jbrowse add-track-json track.json --update',
  ]

  static args = [
    {
      name: 'track',
      required: true,
      description: `track JSON file or command line arg blob`,
    },
  ]

  static flags = {
    update: flags.boolean({
      char: 'u',
      description: `update the contents of an existing track, matched based on trackId`,
    }),
    config: flags.string({
      char: 'c',
      description:
        'Config file; if the file does not exist, it will be created',
      default: './config.json',
    }),
  }

  async run() {
    await this.checkLocation()
    const { args, flags: runFlags } = this.parse(AddTrackJson)
    const { track: inputtedTrack } = args as { track: string }
    this.debug(`Sequence location is: ${inputtedTrack}`)
    const { update, config: inputtedConfig } = runFlags

    const config = JSON.parse(await this.readJsonConfig(inputtedConfig))
    this.debug(`Found existing config file ${config}`)

    const track = await this.readInlineOrFileJson(inputtedTrack)
    const idx = config.tracks.findIndex(
      ({ trackId }: { trackId: string }) => trackId === track.trackId,
    )
    if (idx !== -1) {
      const existing = config.tracks[idx].name
      this.debug(`Found existing track ${existing} in configuration`)
      if (update) {
        this.debug(`Overwriting track ${existing} in configuration`)
        config.tracks[idx] = track
      } else {
        this.error(
          `Cannot add track ${track.name}, a track with that trackId already exists: ${existing}`,
          { exit: 40 },
        )
      }
    } else {
      config.tracks.push(track)
    }
    this.debug(`Writing configuration to file ${inputtedConfig}`)
    await fsPromises.writeFile(
      inputtedConfig,
      JSON.stringify(config, undefined, 2),
    )
    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${track.name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${inputtedConfig}`,
    )
  }

  async checkLocation() {
    let manifestJson: string
    try {
      manifestJson = await fsPromises.readFile('manifest.json', {
        encoding: 'utf8',
      })
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

  async resolveFileLocation(location: string, check = true) {
    let locationUrl: URL | undefined
    let locationPath: string | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      let response
      try {
        if (check) {
          response = await fetch(locationUrl, { method: 'HEAD' })
          if (response.ok) {
            return locationUrl.href
          }
        } else {
          return locationUrl.href
        }
      } catch (error) {
        // ignore
      }
    }
    try {
      if (check) {
        locationPath = await fsPromises.realpath(location)
      } else {
        locationPath = location
      }
    } catch (e) {
      // ignore
    }
    if (locationPath) {
      const filePath = path.relative(process.cwd(), locationPath)
      if (filePath.startsWith('..')) {
        this.warn(
          `Location ${filePath} is not in the JBrowse directory. Make sure it is still in your server directory.`,
        )
      }
      return filePath
    }
    return this.error(`Could not resolve to a file or a URL: "${location}"`, {
      exit: 90,
    })
  }

  async readInlineOrFileJson(inlineOrFileName: string) {
    let result
    // see if it's inline JSON
    try {
      result = JSON.parse(inlineOrFileName)
    } catch (error) {
      // not inline JSON, must be location of a JSON file
      try {
        const fileLocation = await this.resolveFileLocation(inlineOrFileName)
        const resultJSON = await this.readJsonConfig(fileLocation)
        return JSON.parse(resultJSON)
      } catch (err) {
        this.error(`Not valid inline JSON or JSON file ${inlineOrFileName}`, {
          exit: 100,
        })
      }
    }
    return result
  }

  async readJsonConfig(location: string) {
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }
}
