import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'
import { guessAdapter, guessTrackType } from '@gmod/jbrowse-core/util/tracks'

export default class AddTrack extends Command {
  static description = 'Add a track to a JBrowse 2 configuration'

  static examples = []

  static args = [
    {
      name: 'track',
      required: true,
      description: `track file or URL`,
    },
  ]

  static flags = {
    type: flags.string({
      char: 't',
      description: `type of track, by default inferred from track file`,
      options: [
        'AlignmentsTrack',
        'StructuralVariantChordTrack',
        'WiggleTrack',
        'VariantTrack',
        'DotplotTrack',
        'LinearComparativeTrack',
        'LinearSyntenyTrack',
        'SequenceTrack',
        'ReferenceSequenceTrack',
      ],
    }),
    name: flags.string({
      char: 'n',
      description:
        'Name of the track. Will be defaulted to the trackId if none specified',
    }),
    config: flags.string({
      char: 'c',
      description:
        'JSON config for track, will be updated into existing config',
    }),
    description: flags.string({
      char: 'd',
      description: 'Optional description of the track',
    }),
    help: flags.help({ char: 'h' }),
    trackId: flags.string({
      description:
        'Id for the track, by default inferred from filename, must be unique to JBrowse config',
    }),
    category: flags.string({
      description:
        'Optional Comma separated string of categories to group tracks',
    }),
  }

  async run() {
    await this.checkLocation()
    const { args: runArgs, flags: runFlags } = this.parse(AddTrack)
    const { track: argsTrack } = runArgs as { track: string }

    const { track } = runArgs
    let { type, name, trackId } = runFlags
    const { config } = runFlags

    const trackLocation = await this.resolveFileLocation(argsTrack)
    const { location, protocol } = trackLocation
    if (type) {
      this.debug(`Type is: ${type}`)
    } else {
      const adapter = guessAdapter(location, protocol)
      type = guessTrackType(adapter.type)
    }

    let response
    let file
    if (protocol === 'uri') {
      try {
        response = await fetch(trackLocation.location, {
          method: 'GET',
        })
      } catch (error) {
        this.error(error)
      }
      file = response.json()
    } else {
      file = await fsPromises.readFile(trackLocation.location, {
        encoding: 'utf8',
      })
    }
    if (trackId) {
      this.debug(`Track is :${track}`)
    } else trackId = location.substring(location.lastIndexOf('/') + 1) // get filename and set as name

    if (name) {
      this.debug(`Name is: ${name}`)
    } else name = trackId

    // if type is not specificed, guess the track type based off track extension
    // infer the index file based off the track extension
    // if name and track id not specificed, const name = and const track id = based off file
    // if no category, put in default category
    // confirm track exists using this.resolveFileLocation(argsTrack)
    // add track to config with above info
  }

  guessTrackType(track: string) {
    // if track ends with return 'track'
    // if isvalidJSON/isvalidtrack return basictrack or let them choose
    // else error out
  }

  // pretty much same as add-assembly, dont need skipCheck flag
  async resolveFileLocation(location: string) {
    let locationUrl: URL | undefined
    let locationPath: string | undefined
    let locationObj: {
      location: string
      protocol: 'uri' | 'localPath'
    }
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      let response
      try {
        response = await fetch(locationUrl, { method: 'HEAD' })
        if (response.ok) {
          locationObj = {
            location: locationUrl.href,
            protocol: 'uri',
          }
          return locationObj
        }
      } catch (error) {
        // ignore
      }
    }
    try {
      locationPath = await fsPromises.realpath(location)
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
      locationObj = {
        location: filePath,
        protocol: 'localPath',
      }
      return locationObj
    }
    return this.error(`Could not resolve to a file or a URL: "${location}"`, {
      exit: 90,
    })
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
}
