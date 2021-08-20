import path from 'path'
import fs from 'fs'
import { flags } from '@oclif/command'
import { Readable } from 'stream'
import { ixIxxStream } from 'ixixx'
import JBrowseCommand, { Track, Config } from '../base'
import { indexGff3 } from '../types/gff3Adapter'
import { indexGtf } from '../types/gtfAdapter'
import { indexVcf } from '../types/vcfAdapter'
import { generateMeta } from '../types/common'

export default class TextIndex extends JBrowseCommand {
  static description = 'Make a text-indexing file for any given track(s).'

  static examples = [
    "# indexes all tracks that it can find in the current directory's config.json",
    '$ jbrowse text-index',
    "# indexes specific trackIds that it can find in the current directory's config.json",
    '$ jbrowse text-index --tracks=track1,track2,track3',
    "# indexes all tracks in a directory's config.json or in a specific config file",
    '$ jbrowse text-index --out /path/to/jb2/',
    '$ jbrowse text-index --out /path/to/jb2/some_alt_config.json',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    tracks: flags.string({
      description: `Specific tracks to index, formatted as comma separated trackIds. If unspecified, indexes all available tracks`,
    }),
    target: flags.string({
      description:
        'Path to config file in JB2 installation directory to read from.',
    }),
    out: flags.string({
      description: 'Synonym for target',
    }),

    attributes: flags.string({
      description: 'Comma separated list of attributes to index',
    }),
    assemblies: flags.string({
      char: 'a',
      description:
        'Specify the assembl(ies) to create an index for. If unspecified, creates an index for each assembly in the config',
    }),
    force: flags.boolean({
      default: false,
      description: 'Overwrite previously existing indexes',
    }),
    quiet: flags.boolean({
      char: 'q',
      default: false,
      description: 'Hide the progress bars',
    }),
    perTrack: flags.boolean({
      default: false,
      description:
        'If set, creates an index for each track in the config or set with the tracks flag',
    }),
    include: flags.string({
      description: 'Removes gene type from list of excluded types',
      default: '',
    }),
    exclude: flags.string({
      description: 'Adds gene type to list of excluded types',
      default: '',
    }),
  }

  // Called when running the terminal command. Parses the given flags and
  // tracks associated. Gets their information and sends it to the appropriate
  // file parser to be indexed
  async run() {
    const {
      flags: {
        out,
        target,
        tracks,
        assemblies,
        attributes,
        quiet,
        force,
        include,
        exclude,
        perTrack,
      },
    } = this.parse(TextIndex)
    const outFlag = target || out || '.'
    const confFile = fs.lstatSync(outFlag).isDirectory()
      ? path.join(outFlag, 'config.json')
      : outFlag
    const dir = path.dirname(confFile)
    const config: Config = JSON.parse(fs.readFileSync(confFile, 'utf8'))
    const configTracks = config.tracks || []
    const assembliesToIndex =
      assemblies?.split(',') || config.assemblies?.map(a => a.name) || []
    const aggregateAdapters = config.aggregateTextSearchAdapters || []
    const trixDir = path.join(dir, 'trix')
    if (!fs.existsSync(trixDir)) {
      fs.mkdirSync(trixDir)
    }

    const attributesToIndex = attributes?.split(',') || []

    if (perTrack) {
      if (assemblies) {
        throw new Error(
          `Can't specify assemblies when indexing per track, remove assemblies flag to continue.`,
        )
      }
      const trackConfigs = await this.getConfig(confFile, tracks?.split(','))
      if (!trackConfigs.length) {
        throw new Error(
          `Specified tracks not found and no tracks found in config.json, please add track configurations before indexing.`,
        )
      }
      for (const trackConfig of trackConfigs) {
        const { textSearchConf, trackId, assemblyNames } = trackConfig
        if (textSearchConf?.textSearchAdapter && !force) {
          this.log(
            `Note: ${trackId} has already been indexed with this configuration, use --force to overwrite this track. Skipping for now`,
          )
          continue
        }
        this.log('Indexing track ' + trackId + '...')
        const id = trackId + '-index'
        await this.indexDriver(
          [trackConfig],
          attributesToIndex,
          dir,
          trackId,
          quiet,
          include?.split(','),
          exclude?.split(','),
        )
        await generateMeta(
          trackId,
          attributesToIndex,
          include.split(','),
          exclude.split(','),
          confFile,
          [trackConfig],
        )
        if (!textSearchConf || !textSearchConf?.textSearchAdapter) {
          const newTextSearchConf = {
            ...textSearchConf,
            textSearchAdapter: {
              type: 'TrixTextSearchAdapter',
              textSearchAdapterId: id,
              ixFilePath: {
                uri: `trix/${trackId}.ix`,
              },
              ixxFilePath: {
                uri: `trix/${trackId}.ixx`,
              },
              metaFilePath: {
                uri: `trix/${trackId}_meta.json`,
              },
              assemblies: assemblyNames,
            },
          }
          const newTrackConfig = {
            ...trackConfig,
            textSearchConf: newTextSearchConf,
          }
          const index = configTracks.findIndex(
            track => trackId === track.trackId,
          )
          configTracks[index] = newTrackConfig as Track
        }
        fs.writeFileSync(
          confFile,
          JSON.stringify({ ...config, tracks: configTracks }, null, 2),
        )
      }
    } else {
      for (const asm of assembliesToIndex) {
        const trackConfigs = await this.getConfig(
          confFile,
          tracks?.split(','),
          asm,
        )
        this.log('Indexing assembly ' + asm + '...')
        if (!trackConfigs.length) {
          continue
        }
        const id = asm + '-index'
        const adapterAlreadyFound = aggregateAdapters.find(
          x => x.textSearchAdapterId === id,
        )
        if (adapterAlreadyFound && !force) {
          this.log(
            `Note: ${asm} has already been indexed with this configuration, use --force to overwrite this assembly. Skipping for now`,
          )
          continue
        }

        await this.indexDriver(
          trackConfigs,
          attributesToIndex,
          dir,
          asm,
          quiet,
          include?.split(','),
          exclude?.split(','),
        )
        await generateMeta(
          asm,
          attributesToIndex,
          include.split(','),
          exclude.split(','),
          confFile,
          trackConfigs,
        )

        // Checks through list of configs and checks the hash values if it
        // already exists it updates the entry and increments the check varible.
        // If the check variable is equal to 0 that means the entry does not
        // exist and creates one.
        if (!adapterAlreadyFound) {
          aggregateAdapters.push({
            type: 'TrixTextSearchAdapter',
            textSearchAdapterId: id,
            ixFilePath: {
              uri: `trix/${asm}.ix`,
            },
            ixxFilePath: {
              uri: `trix/${asm}.ixx`,
            },
            metaFilePath: {
              uri: `trix/${asm}_meta.json`,
            },
            assemblies: [asm],
          })
        }
      }

      fs.writeFileSync(
        confFile,
        JSON.stringify(
          { ...config, aggregateTextSearchAdapters: aggregateAdapters },
          null,
          2,
        ),
      )
    }

    this.log('Finished!')
  }

  /**
   * This function takes a list of tracks, as well as which attributes to
   * index, and indexes them all into one aggregate index.
   * @param configs - array of trackConfigs to index
   * @param attributes - array of attributes to index by
   * @param out - output directory
   * @param name - assembly name or trackId to index
   * @param quiet - boolean flag to remove progress bars
   * @param include - array of feature types to include on index
   * @param exclude - array of feature types to exclude on index
   */
  async indexDriver(
    configs: Track[],
    attributes: string[],
    out: string,
    name: string,
    quiet: boolean,
    include: string[],
    exclude: string[],
  ) {
    const readable = Readable.from(
      this.indexFile(configs, attributes, out, quiet, include, exclude),
    )
    return this.runIxIxx(readable, out, name)
  }

  async *indexFile(
    configs: Track[],
    attributesToIndex: string[],
    outLocation: string,
    quiet: boolean,
    typesToInclude: string[],
    typesToExclude: string[],
  ) {
    for (const config of configs) {
      const {
        adapter: { type },
        textSearchConf,
      } = config

      const types: Array<string> = textSearchConf?.indexingFeatureTypesToExclude || [
        'CDS',
        'exon',
      ]

      for (const inc of typesToInclude) {
        const index = types.indexOf(inc)
        if (index > -1) {
          types.splice(index, 1)
        }
      }
      for (const exc of typesToExclude) {
        if (exc.length > 0) {
          types.push(exc)
        }
      }

      const attrs =
        attributesToIndex.length && attributesToIndex
          ? attributesToIndex
          : textSearchConf?.indexingAttributes || ['Name', 'ID']

      if (type === 'Gff3TabixAdapter') {
        yield* indexGff3(config, attrs, outLocation, types, quiet)
      } else if (type === 'GtfTabixAdapter') {
        yield* indexGtf(config, attrs, outLocation, types, quiet)
      } else if (type === 'VcfTabixAdapter') {
        yield* indexVcf(config, attrs, outLocation, types, quiet)
      }
    }
  }

  /**
   * Given a readStream of data, indexes the stream into .ix and .ixx files
    using ixIxx.  The ixIxx executable is required on the system path for
    users, however tests use a local copy.  Returns a promise around ixIxx
    completing (or erroring).
   * @param readStream - Given a readStream of data
   * @param outLocation - path to ouput location
   * @param name -  assembly name or trackId
   */
  runIxIxx(readStream: Readable, outLocation: string, name: string) {
    const ixFilename = path.join(outLocation, 'trix', `${name}.ix`)
    const ixxFilename = path.join(outLocation, 'trix', `${name}.ixx`)

    return ixIxxStream(readStream, ixFilename, ixxFilename)
  }

  // Function that takes in an array of tracks and returns an array of
  // identifiers stating what will be indexed
  async getConfig(
    configPath: string,
    trackIds?: string[],
    assemblyName?: string,
  ) {
    const { tracks } = (await this.readJsonFile(configPath)) as Config
    if (!tracks) {
      throw new Error(
        'No tracks found in config.json. Please add a track before indexing.',
      )
    }
    const trackIdsToIndex = trackIds || tracks.map(track => track.trackId)
    const supportedTracksToIndex = trackIdsToIndex
      .map(trackId => {
        const currentTrack = tracks.find(t => trackId === t.trackId)
        if (!currentTrack) {
          throw new Error(
            `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
          )
        }
        return currentTrack
      })
      .filter(track => supported(track.adapter.type))

    if (assemblyName) {
      return supportedTracksToIndex.filter(track =>
        track.assemblyNames.includes(assemblyName),
      )
    }

    return supportedTracksToIndex
  }
}

function supported(type: string) {
  return ['Gff3TabixAdapter', 'GtfTabixAdapter', 'VcfTabixAdapter'].includes(
    type,
  )
}
