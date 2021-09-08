import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { ixIxxStream } from 'ixixx'
import { flags } from '@oclif/command'
import { indexGff3 } from '../types/gff3Adapter'
import { indexGtf } from '../types/gtfAdapter'
import { indexVcf } from '../types/vcfAdapter'
import JBrowseCommand, { Track, Config } from '../base'
import {
  generateMeta,
  supported,
  guessAdapterFromFileName,
} from '../types/common'

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

    // indexing individual files, assumes no config.json
    if (file) {
      const trixDir = path.join(outFlag, 'trix')
      if (!fs.existsSync(trixDir)) {
        fs.mkdirSync(trixDir)
      }

      const configs = file
        .map(file => guessAdapterFromFileName(file))
        .filter(fileConfig => supported(fileConfig.adapter.type))

      await this.indexDriver({
        configs,
        outDir: outFlag,
        name: 'aggregate',
        quiet,
        attributes: attributes.split(','),
        exclude: exclude.split(','),
        assemblyNames: [],
      })
    }

    // indexing in pertrack mode
    else if (perTrack) {
      const confFilePath = fs.lstatSync(outFlag).isDirectory()
        ? path.join(outFlag, 'config.json')
        : outFlag
      const outDir = path.dirname(confFilePath)
      const config: Config = JSON.parse(fs.readFileSync(confFilePath, 'utf8'))
      const configTracks = config.tracks || []

      const trixDir = path.join(outDir, 'trix')
      if (!fs.existsSync(trixDir)) {
        fs.mkdirSync(trixDir)
      }
      if (assemblies) {
        throw new Error(
          `Can't specify assemblies when indexing per track, remove assemblies flag to continue.`,
        )
      }
      const confs = await this.getTrackConfigs(confFilePath, tracks?.split(','))
      if (!confs.length) {
        throw new Error(
          `Tracks not found in config.json, please add track configurations before indexing.`,
        )
      }
      for (const trackConfig of confs) {
        const { textSearching, trackId, assemblyNames } = trackConfig
        if (textSearching?.textSearchAdapter && !force) {
          this.log(
            `Note: ${trackId} has already been indexed with this configuration, use --force to overwrite this track. Skipping for now`,
          )
          continue
        }
        this.log('Indexing track ' + trackId + '...')

        const id = trackId + '-index'
        await this.indexDriver({
          configs: [trackConfig],
          attributes: attributes.split(','),
          outDir,
          quiet,
          name: trackId,
          exclude: exclude.split(','),
          assemblyNames,
        })
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
                assemblyNames: assemblyNames,
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
          confFilePath,
          JSON.stringify({ ...config, tracks: configTracks }, null, 2),
        )
      }
    }

    // creates an aggregate index per assembly
    else {
      const confFilePath = fs.lstatSync(outFlag).isDirectory()
        ? path.join(outFlag, 'config.json')
        : outFlag
      const outDir = path.dirname(confFilePath)
      const config: Config = JSON.parse(fs.readFileSync(confFilePath, 'utf8'))

      const trixDir = path.join(outDir, 'trix')
      if (!fs.existsSync(trixDir)) {
        fs.mkdirSync(trixDir)
      }

      const aggregateAdapters = config.aggregateTextSearchAdapters || []
      const asms = assemblies?.split(',') || config.assemblies?.map(a => a.name)

      if (!asms?.length) {
        throw new Error('No assemblies found')
      }

      for (const asm of asms) {
        const configs = await this.getTrackConfigs(
          confFilePath,
          tracks?.split(','),
          asm,
        )
        this.log('Indexing assembly ' + asm + '...')
        if (!configs.length) {
          continue
        }
        const id = asm + '-index'
        const found = aggregateAdapters.find(x => x.textSearchAdapterId === id)
        if (found && !force) {
          this.log(
            `Note: ${asm} has already been indexed with this configuration, use --force to overwrite this assembly. Skipping for now`,
          )
          continue
        }

        await this.indexDriver({
          configs,
          outDir,
          quiet,
          name: asm,
          attributes: attributes.split(','),
          exclude: exclude.split(','),
          assemblyNames: [asm],
        })
        if (!found) {
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
            assemblyNames: [asm],
          })
        }
      }
      fs.writeFileSync(
        confFilePath,
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
  async indexDriver({
    configs,
    attributes,
    outDir,
    name,
    quiet,
    exclude,
    assemblyNames,
  }: {
    configs: Track[]
    attributes: string[]
    outDir: string
    name: string
    quiet: boolean
    exclude: string[]
    assemblyNames: string[]
  }) {
    const readable = Readable.from(
      this.indexFiles(configs, attributes, outDir, quiet, exclude),
    )

    const ixIxxStream = await this.runIxIxx(readable, outDir, name)

    await generateMeta({
      configs,
      attributes,
      outDir,
      name,
      exclude,
      assemblyNames,
    })
    return ixIxxStream
  }

  async *indexFiles(
    trackConfigs: Track[],
    attributes: string[],
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

      const attrs = textSearching?.indexingAttributes || attributes

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
   * using ixixx-js
   *
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
      .filter(track => supported(track.adapter.type))
      .filter(track =>
        assemblyName ? track.assemblyNames.includes(assemblyName) : true,
      )
  }
}
