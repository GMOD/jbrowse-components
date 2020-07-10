import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

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
    const { args: runArgs, flags: runFlags } = this.parse(AddTrack)
    const { track: argsTrack } = runArgs as { track: string }

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
          return locationUrl.href
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
      return filePath
    }
    return this.error(`Could not resolve to a file or a URL: "${location}"`, {
      exit: 90,
    })
  }
}
