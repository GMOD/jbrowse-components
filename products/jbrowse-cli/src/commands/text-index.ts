import path from 'path'
import fs from 'fs'
import { flags } from '@oclif/command'
import { Readable } from 'stream'
import { ixIxxStream } from 'ixixx'
import JBrowseCommand, { Track, Config } from '../base'
import { indexGff3 } from '../types/gff3Adapter'
import { indexGtf } from '../types/gtfAdapter'
import { indexVcf } from '../types/vcfAdapter'
import { generateMeta, supportedTrack } from '../types/common'

export default class TextIndex extends JBrowseCommand {
  static description = 'Make a text-indexing file for any given track(s).'

  static examples = [
    "# indexes all tracks that it can find in the current directory's config.json",
    '$ jbrowse text-index',
    '',
    "# indexes specific trackIds that it can find in the current directory's config.json",
    '$ jbrowse text-index --tracks=track1,track2,track3',
    '',
    "# indexes all tracks in a directory's config.json or in a specific config file",
    '$ jbrowse text-index --out /path/to/jb2/',
    '',
    '# indexes only a specific assembly, and overwrite what was previously there using force (which is needed if a previous index already existed)',
    '$ jbrowse text-index -a hg19 --force',
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
      default: 'Name,ID',
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
      description: 'If set, creates an index per track',
    }),
    exclude: flags.string({
      description: 'Adds gene type to list of excluded types',
      default: 'CDS,exon',
    }),
    file: flags.string({
      description: 'File or files to index.',
      multiple: true,
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
        exclude,
        perTrack,
        file,
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
    // console.log('File', file)
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
      const trackConfigs = await this.getTrackConfigs(
        confFile,
        tracks?.split(','),
      )
      if (!trackConfigs.length) {
        throw new Error(
          `Tracks not found in config.json, please add track configurations before indexing.`,
        )
      }
      for (const trackConfig of trackConfigs) {
        const { textSearching, trackId, assemblyNames } = trackConfig
        if (textSearching?.textSearchAdapter && !force) {
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
          trackId, // name of index
          quiet,
          exclude?.split(','),
          confFile,
          assemblyNames,
        )
        if (!textSearching || !textSearching?.textSearchAdapter) {
          const newTrackConfig = {
            ...trackConfig,
            textSearching: {
              ...textSearching,
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
            },
          }
          // modifies track with new text search adapter
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
      // creates an aggregate index per assembly
      for (const asm of assembliesToIndex) {
        const trackConfigs = await this.getTrackConfigs(
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
          exclude?.split(','),
          confFile,
          [asm],
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
   * @param assemblies - assemblies covered by index
   */
  async indexDriver(
    configs: Track[],
    attributes: string[],
    out: string,
    name: string,
    quiet: boolean,
    exclude: string[],
    confFile: string,
    assemblies: string[],
  ) {
    const readable = Readable.from(
      this.indexFiles(configs, attributes, out, quiet, exclude),
    )
    const ixIxxStream = await this.runIxIxx(readable, out, name)

    await generateMeta(
      configs,
      attributes,
      out,
      name,
      quiet,
      exclude,
      confFile,
      assemblies,
    )
    return ixIxxStream
  }

  async *indexFiles(
    trackConfigs: Track[],
    attributesToIndex: string[],
    outLocation: string,
    quiet: boolean,
    typesToExclude: string[],
  ) {
    for (const config of trackConfigs) {
      const {
        adapter: { type },
        textSearching,
      } = config

      const types =
        textSearching?.indexingFeatureTypesToExclude || typesToExclude

      const attrs = textSearching?.indexingAttributes || attributesToIndex

      if (type === 'Gff3TabixAdapter') {
        yield* indexGff3(config, attrs, outLocation, types, quiet)
      } else if (type === 'GtfTabixAdapter') {
        yield* indexGtf(config, attrs, outLocation, types, quiet)
      } else if (type === 'VcfTabixAdapter') {
        yield* indexVcf(config, attrs, outLocation, types, quiet)
      }
    }
  }

  // getTrackUri(config: Track) {
  //   const { adapter } = config
  //   const { type } = adapter
  //   if (type === 'Gff3TabixAdapter') {
  //     const {
  //       gffGzLocation: { uri },
  //     } = adapter as Gff3TabixAdapter
  //     return uri
  //   } else if (type === 'GtfTabixAdapter') {
  //     const {
  //       gtfGzLocation: { uri },
  //     } = adapter as GtfTabixAdapter
  //     return uri
  //   } else if (type === 'VcfTabixAdapter') {
  //     const {
  //       vcfGzLocation: { uri },
  //     } = adapter as VcfTabixAdapter
  //     return uri
  //   }
  // }
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

  /**
   * Function that takes in an array of tracks and returns an array of
   * identifiers stating what will be indexed
   * @param configPath - path to config.json file
   * @param trackIds - (optional) list of trackIds
   * @param assemblyName - (optional) assembly name to filter tracks by
   */
  async getTrackConfigs(
    configPath: string,
    trackIds?: string[],
    assemblyName?: string,
  ) {
    const { tracks } = (await this.readJsonFile(configPath)) as Config
    if (!tracks) {
      return []
    }
    const trackIdsToIndex = trackIds || tracks?.map(track => track.trackId)
    return trackIdsToIndex
      .map(trackId => {
        const currentTrack = tracks.find(t => trackId === t.trackId)
        if (!currentTrack) {
          throw new Error(
            `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
          )
        }
        return currentTrack
      })
      .filter(track => supportedTrack(track.adapter.type))
      .filter(track =>
        assemblyName ? track.assemblyNames.includes(assemblyName) : true,
      )
  }
}
