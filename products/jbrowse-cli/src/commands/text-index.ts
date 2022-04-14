import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { ixIxxStream } from 'ixixx'
import { flags } from '@oclif/command'
import { indexGff3 } from '../types/gff3Adapter'
import { indexVcf } from '../types/vcfAdapter'
import JBrowseCommand, {
  Track,
  Config,
  TrixTextSearchAdapter,
  UriLocation,
  LocalPathLocation,
} from '../base'
import {
  generateMeta,
  supported,
  guessAdapterFromFileName,
} from '../types/common'
import fromEntries from 'object.fromentries'

if (!Object.fromEntries) {
  // @ts-ignore
  fromEntries.shim()
}

function readConf(confFilePath: string) {
  return JSON.parse(fs.readFileSync(confFilePath, 'utf8')) as Config
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
    prefixSize: flags.integer({
      description:
        'Specify the prefix size for the ixx index, increase size if many of your gene IDs have same prefix e.g. Z000000001, Z000000002',
      default: 6,
    }),
    file: flags.string({
      description:
        'File or files to index (can be used to create trix indexes for embedded component use cases not using a config.json for example)',
      multiple: true,
    }),
    dryrun: flags.boolean({
      description:
        'Just print out tracks that will be indexed by the process, without doing any indexing',
    }),
  }

  async run() {
    const { flags } = this.parse(TextIndex)
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
    const { flags } = this.parse(TextIndex)
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
    const outDir = path.dirname(confPath)
    const config = readConf(confPath)

    const trixDir = path.join(outDir, 'trix')
    if (!fs.existsSync(trixDir)) {
      fs.mkdirSync(trixDir)
    }

    const aggregateAdapters = config.aggregateTextSearchAdapters || []
    const asms =
      assemblies?.split(',') ||
      config.assemblies?.map(a => a.name) ||
      (config.assembly ? [config.assembly.name] : [])

    if (!asms?.length) {
      throw new Error('No assemblies found')
    }

    for (const asm of asms) {
      const configs = await this.getTrackConfigs(
        confPath,
        tracks?.split(','),
        asm,
      )
      this.log('Indexing assembly ' + asm + '...')
      if (!configs.length) {
        continue
      }

      if (dryrun) {
        this.log(configs.map(e => `${e.trackId}\t${e.adapter.type}`).join('\n'))
      } else {
        const id = asm + '-index'
        const foundIdx = aggregateAdapters.findIndex(
          x => x.textSearchAdapterId === id,
        )
        if (foundIdx !== -1 && !force) {
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

        if (foundIdx === -1) {
          aggregateAdapters.push(trixConf)
        } else {
          aggregateAdapters[foundIdx] = trixConf
        }
      }
    }

    if (!dryrun) {
      fs.writeFileSync(
        confPath,
        JSON.stringify(
          { ...config, aggregateTextSearchAdapters: aggregateAdapters },
          null,
          2,
        ),
      )
    }
  }

  async perTrackIndex() {
    const { flags } = this.parse(TextIndex)
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
    const outDir = path.dirname(confFilePath)
    const config = readConf(confFilePath)
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
        prefixSize,
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
        // modifies track with new text search adapter
        const index = configTracks.findIndex(track => trackId === track.trackId)
        configTracks[index] = newTrackConfig
      }
      fs.writeFileSync(
        confFilePath,
        JSON.stringify({ ...config, tracks: configTracks }, null, 2),
      )
    }
  }

  async indexFileList() {
    const { flags } = this.parse(TextIndex)
    const { out, target, file, attributes, quiet, exclude, prefixSize } = flags
    const outFlag = target || out || '.'
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
      name: configs.length > 1 ? 'aggregate' : path.basename(file[0]),
      quiet,
      attributes: attributes.split(','),
      exclude: exclude.split(','),
      assemblyNames: [],
      prefixSize,
    })

    this.log(
      'Successfully created index for these files. See https://jbrowse.org/storybook/lgv/main/?path=/story/text-searching--page for info about usage',
    )
  }

  async indexDriver({
    configs,
    attributes,
    outDir,
    name,
    quiet,
    exclude,
    assemblyNames,
    prefixSize,
  }: {
    configs: Track[]
    attributes: string[]
    outDir: string
    name: string
    quiet: boolean
    exclude: string[]
    assemblyNames: string[]
    prefixSize: number
  }) {
    const readable = Readable.from(
      this.indexFiles(configs, attributes, outDir, quiet, exclude),
    )

    const ixIxxStream = await this.runIxIxx(readable, outDir, name, prefixSize)

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

  getLoc(elt: UriLocation | LocalPathLocation) {
    if (elt.locationType === 'LocalPathLocation') {
      return elt.localPath
    }
    return elt.uri
  }
  async *indexFiles(
    trackConfigs: Track[],
    attributes: string[],
    outLocation: string,
    quiet: boolean,
    typesToExclude: string[],
  ) {
    for (const config of trackConfigs) {
      const { adapter, textSearching } = config
      const { type } = adapter
      const {
        indexingFeatureTypesToExclude: types = typesToExclude,
        indexingAttributes: attrs = attributes,
      } = textSearching || {}

      if (type === 'Gff3TabixAdapter') {
        yield* indexGff3(
          config,
          attrs,
          this.getLoc(adapter.gffGzLocation),
          outLocation,
          types,
          quiet,
        )
      } else if (type === 'Gff3Adapter') {
        yield* indexGff3(
          config,
          attrs,
          this.getLoc(adapter.gffLocation),
          outLocation,
          types,
          quiet,
        )
      } else if (type === 'VcfTabixAdapter') {
        yield* indexVcf(
          config,
          attrs,
          this.getLoc(adapter.vcfGzLocation),
          outLocation,
          types,
          quiet,
        )
      } else if (type === 'VcfAdapter') {
        yield* indexVcf(
          config,
          attrs,
          this.getLoc(adapter.vcfLocation),
          outLocation,
          types,
          quiet,
        )
      }

      // gtf unused currently
    }
  }

  runIxIxx(
    readStream: Readable,
    outLocation: string,
    name: string,
    prefixSize: number,
  ) {
    const ixFilename = path.join(outLocation, 'trix', `${name}.ix`)
    const ixxFilename = path.join(outLocation, 'trix', `${name}.ixx`)

    return ixIxxStream(readStream, ixFilename, ixxFilename, prefixSize)
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
      .filter(track => supported(track.adapter?.type))
      .filter(track =>
        assemblyName ? track.assemblyNames.includes(assemblyName) : true,
      )
  }
}
