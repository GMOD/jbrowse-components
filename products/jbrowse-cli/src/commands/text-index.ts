import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { Flags } from '@oclif/core'
import { ixIxxStream } from 'ixixx'

// locals
import JBrowseCommand from '../base'
import {
  generateMeta,
  supported,
  guessAdapterFromFileName,
} from '../types/common'
import { indexGff3 } from '../types/gff3Adapter'
import { indexVcf } from '../types/vcfAdapter'
import type {
  Track,
  Config,
  TrixTextSearchAdapter,
  UriLocation,
  LocalPathLocation,
} from '../base'

function readConf(path: string) {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as Config
}

function writeConf(obj: Config, path: string) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2))
}

function getLoc(elt: UriLocation | LocalPathLocation) {
  return elt.locationType === 'LocalPathLocation' ? elt.localPath : elt.uri
}

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
    '',
    '# create index for some files for use in @jbrowse/react-linear-genome-view or similar',
    '$ jbrowse text-index --file myfile.gff3.gz --file myfile.vcfgz --out indexes',
  ]

  static flags = {
    help: Flags.help({ char: 'h' }),
    tracks: Flags.string({
      description:
        'Specific tracks to index, formatted as comma separated trackIds. If unspecified, indexes all available tracks',
    }),
    target: Flags.string({
      description:
        'Path to config file in JB2 installation directory to read from.',
    }),
    out: Flags.string({
      description: 'Synonym for target',
    }),

    attributes: Flags.string({
      description: 'Comma separated list of attributes to index',
      default: 'Name,ID',
    }),
    assemblies: Flags.string({
      char: 'a',
      description:
        'Specify the assembl(ies) to create an index for. If unspecified, creates an index for each assembly in the config',
    }),
    force: Flags.boolean({
      default: false,
      description: 'Overwrite previously existing indexes',
    }),
    quiet: Flags.boolean({
      char: 'q',
      default: false,
      description: 'Hide the progress bars',
    }),
    perTrack: Flags.boolean({
      default: false,
      description: 'If set, creates an index per track',
    }),
    exclude: Flags.string({
      description: 'Adds gene type to list of excluded types',
      default: 'CDS,exon',
    }),
    prefixSize: Flags.integer({
      description:
        'Specify the prefix size for the ixx index. We attempt to automatically calculate this, but you can manually specify this too. If many genes have similar gene IDs e.g. Z000000001, Z000000002 the prefix size should be larger so that they get split into different bins',
    }),
    file: Flags.string({
      description:
        'File or files to index (can be used to create trix indexes for embedded component use cases not using a config.json for example)',
      multiple: true,
    }),
    fileId: Flags.string({
      description:
        'Set the trackId used for the indexes generated with the --file argument',
      multiple: true,
    }),
    dryrun: Flags.boolean({
      description:
        'Just print out tracks that will be indexed by the process, without doing any indexing',
    }),
  }

  async run() {
    const { flags } = await this.parse(TextIndex)
    const { perTrack, file } = flags

    if (file) {
      await this.indexFileList()
    } else if (perTrack) {
      await this.perTrackIndex()
    } else {
      await this.aggregateIndex()
    }
    this.log('Finished!')
  }

  async aggregateIndex() {
    const { flags } = await this.parse(TextIndex)
    const {
      out,
      target,
      tracks,
      assemblies,
      attributes,
      quiet,
      force,
      exclude,
      dryrun,
      prefixSize,
    } = flags
    const outFlag = target || out || '.'
    const isDir = fs.lstatSync(outFlag).isDirectory()
    const confPath = isDir ? path.join(outFlag, 'config.json') : outFlag
    const outLocation = path.dirname(confPath)
    const config = readConf(confPath)

    const trixDir = path.join(outLocation, 'trix')
    if (!fs.existsSync(trixDir)) {
      fs.mkdirSync(trixDir)
    }

    const aggregateTextSearchAdapters = config.aggregateTextSearchAdapters || []
    const asms =
      assemblies?.split(',') ||
      config.assemblies?.map(a => a.name) ||
      (config.assembly ? [config.assembly.name] : [])

    if (!asms.length) {
      throw new Error('No assemblies found')
    }

    for (const asm of asms) {
      const trackConfigs = await this.getTrackConfigs(
        confPath,
        tracks?.split(','),
        asm,
      )
      if (!trackConfigs.length) {
        this.log(`Indexing assembly ${asm}...(no tracks found)...`)
        continue
      }
      this.log(`Indexing assembly ${asm}...`)

      if (dryrun) {
        this.log(
          trackConfigs.map(e => `${e.trackId}\t${e.adapter?.type}`).join('\n'),
        )
      } else {
        const id = `${asm}-index`
        const idx = aggregateTextSearchAdapters.findIndex(
          x => x.textSearchAdapterId === id,
        )
        if (idx !== -1 && !force) {
          this.log(
            `Note: ${asm} has already been indexed with this configuration, use --force to overwrite this assembly. Skipping for now`,
          )
          continue
        }

        await this.indexDriver({
          trackConfigs,
          outLocation,
          quiet,
          name: asm,
          attributes: attributes.split(','),
          typesToExclude: exclude.split(','),
          assemblyNames: [asm],
          prefixSize,
        })

        const trixConf = {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: id,
          ixFilePath: {
            uri: `trix/${asm}.ix`,
            locationType: 'UriLocation',
          },
          ixxFilePath: {
            uri: `trix/${asm}.ixx`,
            locationType: 'UriLocation',
          },
          metaFilePath: {
            uri: `trix/${asm}_meta.json`,
            locationType: 'UriLocation',
          },
          assemblyNames: [asm],
        } as TrixTextSearchAdapter

        if (idx === -1) {
          aggregateTextSearchAdapters.push(trixConf)
        } else {
          aggregateTextSearchAdapters[idx] = trixConf
        }
      }
    }

    if (!dryrun) {
      writeConf(
        {
          ...config,
          aggregateTextSearchAdapters,
        },
        confPath,
      )
    }
  }

  async perTrackIndex() {
    const { flags } = await this.parse(TextIndex)
    const {
      out,
      target,
      tracks,
      assemblies,
      attributes,
      quiet,
      force,
      exclude,
      prefixSize,
    } = flags
    const outFlag = target || out || '.'

    const isDir = fs.lstatSync(outFlag).isDirectory()
    const confFilePath = isDir ? path.join(outFlag, 'config.json') : outFlag
    const outLocation = path.dirname(confFilePath)
    const config = readConf(confFilePath)
    const configTracks = config.tracks || []
    const trixDir = path.join(outLocation, 'trix')
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
        'Tracks not found in config.json, please add track configurations before indexing.',
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
      this.log(`Indexing track ${trackId}...`)

      await this.indexDriver({
        trackConfigs: [trackConfig],
        attributes: attributes.split(','),
        outLocation,
        quiet,
        name: trackId,
        typesToExclude: exclude.split(','),
        assemblyNames,
        prefixSize,
      })
      if (!textSearching?.textSearchAdapter) {
        // modifies track with new text search adapter
        const index = configTracks.findIndex(track => trackId === track.trackId)
        if (index !== -1) {
          configTracks[index] = {
            ...trackConfig,
            textSearching: {
              ...textSearching,
              textSearchAdapter: {
                type: 'TrixTextSearchAdapter',
                textSearchAdapterId: `${trackId}-index`,
                ixFilePath: {
                  uri: `trix/${trackId}.ix`,
                  locationType: 'UriLocation' as const,
                },
                ixxFilePath: {
                  uri: `trix/${trackId}.ixx`,
                  locationType: 'UriLocation' as const,
                },
                metaFilePath: {
                  uri: `trix/${trackId}_meta.json`,
                  locationType: 'UriLocation' as const,
                },
                assemblyNames: assemblyNames,
              },
            },
          }
        } else {
          this.log("Error: can't find trackId")
        }
      }
      writeConf({ ...config, tracks: configTracks }, confFilePath)
    }
  }

  async indexFileList() {
    const { flags } = await this.parse(TextIndex)
    const {
      out,
      target,
      fileId,
      file,
      attributes,
      quiet,
      exclude,
      prefixSize,
    } = flags
    if (!file) {
      throw new Error('Cannot index file list without files')
    }
    const outFlag = target || out || '.'
    const trixDir = path.join(outFlag, 'trix')
    if (!fs.existsSync(trixDir)) {
      fs.mkdirSync(trixDir)
    }

    const trackConfigs = file
      .map(file => guessAdapterFromFileName(file))
      .filter(fileConfig => supported(fileConfig.adapter?.type))

    if (fileId?.length) {
      for (let i = 0; i < fileId.length; i++) {
        trackConfigs[i]!.trackId = fileId[i]!
      }
    }

    await this.indexDriver({
      trackConfigs,
      outLocation: outFlag,
      name: trackConfigs.length > 1 ? 'aggregate' : path.basename(file[0]!),
      quiet,
      attributes: attributes.split(','),
      typesToExclude: exclude.split(','),
      assemblyNames: [],
      prefixSize,
    })

    this.log(
      'Successfully created index for these files. See https://jbrowse.org/storybook/lgv/main/?path=/story/text-searching--page for info about usage',
    )
  }

  async indexDriver({
    trackConfigs,
    attributes,
    outLocation,
    name,
    quiet,
    typesToExclude,
    assemblyNames,
    prefixSize,
  }: {
    trackConfigs: Track[]
    attributes: string[]
    outLocation: string
    name: string
    quiet: boolean
    typesToExclude: string[]
    assemblyNames: string[]
    prefixSize?: number
  }) {
    const readStream = Readable.from(
      this.indexFiles({
        trackConfigs,
        attributes,
        outLocation,
        quiet,
        typesToExclude,
      }),
    )

    await this.runIxIxx({
      readStream,
      outLocation,
      name,
      prefixSize,
    })

    await generateMeta({
      trackConfigs,
      attributes,
      outLocation,
      name,
      typesToExclude,
      assemblyNames,
    })
  }

  async *indexFiles({
    trackConfigs,
    attributes,
    outLocation,
    quiet,
    typesToExclude,
  }: {
    trackConfigs: Track[]
    attributes: string[]
    outLocation: string
    quiet: boolean
    typesToExclude: string[]
  }) {
    for (const config of trackConfigs) {
      const { adapter, textSearching } = config
      const { type } = adapter || {}
      const {
        indexingFeatureTypesToExclude = typesToExclude,
        indexingAttributes = attributes,
      } = textSearching || {}

      let loc: UriLocation | LocalPathLocation
      if (type === 'Gff3TabixAdapter') {
        // @ts-expect-error
        loc = adapter.gffGzLocation
      } else if (type === 'Gff3Adapter') {
        // @ts-expect-error
        loc = adapter.gffLocation
      } else if (type === 'VcfAdapter') {
        // @ts-expect-error
        loc = adapter.vcfLocation
      } else if (type === 'VcfTabixAdapter') {
        // @ts-expect-error
        loc = adapter.vcfGzLocation
      } else {
        return
      }

      if (type === 'Gff3TabixAdapter' || type === 'Gff3Adapter') {
        yield* indexGff3({
          config,
          attributesToIndex: indexingAttributes,
          inLocation: getLoc(loc),
          outLocation,
          typesToExclude: indexingFeatureTypesToExclude,
          quiet,
        })
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      else if (type === 'VcfTabixAdapter' || type === 'VcfAdapter') {
        yield* indexVcf({
          config,
          attributesToIndex: indexingAttributes,
          inLocation: getLoc(loc),
          outLocation,
          typesToExclude: indexingFeatureTypesToExclude,
          quiet,
        })
      }
    }
  }

  async runIxIxx({
    readStream,
    outLocation,
    name,
    prefixSize,
  }: {
    readStream: Readable
    outLocation: string
    name: string
    prefixSize?: number
  }) {
    await ixIxxStream(
      readStream,
      path.join(outLocation, 'trix', `${name}.ix`),
      path.join(outLocation, 'trix', `${name}.ixx`),
      prefixSize,
    )
  }

  async getTrackConfigs(
    configPath: string,
    trackIds?: string[],
    assemblyName?: string,
  ) {
    const { tracks } = readConf(configPath)
    if (!tracks) {
      return []
    }
    const trackIdsToIndex = trackIds || tracks.map(track => track.trackId)
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
      .filter(track => supported(track.adapter?.type))
      .filter(track =>
        assemblyName ? track.assemblyNames.includes(assemblyName) : true,
      )
  }
}
