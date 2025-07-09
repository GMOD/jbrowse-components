import fs from 'fs'
import path from 'path'
import { Readable } from 'stream'
import { parseArgs } from 'util'

import { ixIxxStream } from 'ixixx'

import NativeCommand from '../native-base'
import { guessAdapterFromFileName, supported } from '../types/common'
import { indexGff3 } from '../types/gff3Adapter'
import { indexVcf } from '../types/vcfAdapter'

import type {
  Config,
  LocalPathLocation,
  Track,
  TrixTextSearchAdapter,
  UriLocation,
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

export default class TextIndexNative extends NativeCommand {
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
    '# create index for some files for use in @jbrowse/react-linear-genome-view2 or similar',
    '$ jbrowse text-index --file myfile.gff3.gz --file myfile.vcfgz --out indexes',
  ]

  async run() {
    const { values: flags, positionals } = parseArgs({
      args: process.argv.slice(3), // Skip node, script, and command name
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        tracks: {
          type: 'string',
        },
        target: {
          type: 'string',
        },
        out: {
          type: 'string',
        },
        attributes: {
          type: 'string',
        },
        assemblies: {
          type: 'string',
          short: 'a',
        },
        force: {
          type: 'boolean',
          default: false,
        },
        quiet: {
          type: 'boolean',
          short: 'q',
          default: false,
        },
        perTrack: {
          type: 'boolean',
          default: false,
        },
        exclude: {
          type: 'string',
        },
        prefixSize: {
          type: 'string', // parseArgs doesn't have integer type, we'll parse this manually
        },
        file: {
          type: 'string',
          multiple: true,
        },
        dryrun: {
          type: 'boolean',
          default: false,
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
      return
    }

    const {
      tracks,
      target,
      out,
      attributes = 'Name,ID',
      assemblies,
      force,
      quiet,
      perTrack,
      exclude = 'CDS,exon',
      prefixSize,
      file,
      dryrun,
    } = flags

    // Parse prefixSize to integer if provided
    const prefixSizeInt = prefixSize ? parseInt(prefixSize, 10) : undefined
    if (prefixSize && isNaN(prefixSizeInt!)) {
      console.error('Error: prefixSize must be a valid integer')
      process.exit(1)
    }

    const output = target || out || '.'
    const outputPath = output.endsWith('.json')
      ? output
      : path.join(output, 'config.json')

    // Either index from config.json or from individual files
    if (file && file.length > 0) {
      await this.indexFromFiles(file, {
        attributes,
        exclude,
        prefixSize: prefixSizeInt,
        force,
        quiet,
        dryrun,
        outputPath,
      })
    } else {
      await this.indexFromConfig({
        outputPath,
        tracks,
        attributes,
        assemblies,
        force,
        quiet,
        perTrack,
        exclude,
        prefixSize: prefixSizeInt,
        dryrun,
      })
    }
  }

  async indexFromFiles(
    files: string[],
    options: {
      attributes: string
      exclude: string
      prefixSize?: number
      force: boolean
      quiet: boolean
      dryrun: boolean
      outputPath: string
    },
  ) {
    const {
      attributes,
      exclude,
      prefixSize,
      force,
      quiet,
      dryrun,
      outputPath,
    } = options

    console.log(`Indexing ${files.length} files...`)

    const config: Config = fs.existsSync(outputPath)
      ? readConf(outputPath)
      : {
          assemblies: [],
          tracks: [],
          connections: [],
          defaultSession: { name: 'New Session' },
          aggregateTextSearchAdapters: [],
        }

    if (!config.aggregateTextSearchAdapters) {
      config.aggregateTextSearchAdapters = []
    }

    for (const file of files) {
      const adapterConfig = guessAdapterFromFileName(file)
      if (!adapterConfig) {
        console.warn(`Warning: Could not guess adapter type for file: ${file}`)
        continue
      }

      // @ts-expect-error
      if (!supported(adapterConfig)) {
        console.warn(
          // @ts-expect-error
          `Warning: Adapter type not supported for indexing: ${adapterConfig.type}`,
        )
        continue
      }

      const outDir = path.dirname(outputPath)
      const baseName = path.basename(file, path.extname(file))
      const ixFile = path.join(outDir, `${baseName}.ix`)
      const ixxFile = path.join(outDir, `${baseName}.ixx`)
      const metaFile = path.join(outDir, `${baseName}_meta.json`)

      if (!force && fs.existsSync(ixFile)) {
        console.log(
          `Index already exists for ${file}, skipping (use --force to overwrite)`,
        )
        continue
      }

      if (dryrun) {
        console.log(`Would index ${file} -> ${ixFile}`)
        continue
      }

      console.log(`Indexing ${file}...`)

      const attributesArray = attributes.split(',').map(a => a.trim())
      const excludeArray = exclude.split(',').map(e => e.trim())

      try {
        let readable: Readable
        if (
          // @ts-expect-error
          adapterConfig.type === 'Gff3Adapter' ||
          // @ts-expect-error
          adapterConfig.type === 'Gff3TabixAdapter'
        ) {
          // @ts-expect-error
          readable = await indexGff3({
            config: adapterConfig,
            attributesToIndex: attributesArray,
            inLocation: getLoc(
              // @ts-expect-error
              adapterConfig.gffLocation || adapterConfig.gffGzLocation,
            ),
            outLocation: ixFile,
            typesToExclude: excludeArray,
            quiet,
          })
        } else if (
          // @ts-expect-error
          adapterConfig.type === 'VcfAdapter' ||
          // @ts-expect-error
          adapterConfig.type === 'VcfTabixAdapter'
        ) {
          // @ts-expect-error
          readable = await indexVcf({
            config: adapterConfig,
            attributesToIndex: attributesArray,
            inLocation: getLoc(
              // @ts-expect-error
              adapterConfig.vcfLocation || adapterConfig.vcfGzLocation,
            ),
            outLocation: ixFile,
            typesToExclude: excludeArray,
            quiet,
          })
        } else {
          console.warn(
            // @ts-expect-error
            `Warning: Indexing not implemented for adapter type: ${adapterConfig.type}`,
          )
          continue
        }

        // @ts-expect-error
        const writableStream = ixIxxStream(ixFile, ixxFile, {
          prefixSize: prefixSize || 6,
        })

        await new Promise<void>((resolve, reject) => {
          // @ts-expect-error
          readable.pipe(writableStream)
          // @ts-expect-error
          writableStream.on('finish', resolve)
          // @ts-expect-error
          writableStream.on('error', reject)
        })

        // Generate metadata
        // const meta = generateMeta({
        //   ixFile,
        //   ixxFile,
        //   attributesArray,
        //   excludeArray,
        // })
        // fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2))

        // Add to config
        const adapter: TrixTextSearchAdapter = {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: baseName,
          ixFilePath: {
            uri: path.relative(path.dirname(outputPath), ixFile),
            locationType: 'UriLocation',
          },
          ixxFilePath: {
            uri: path.relative(path.dirname(outputPath), ixxFile),
            locationType: 'UriLocation',
          },
          metaFilePath: {
            uri: path.relative(path.dirname(outputPath), metaFile),
            locationType: 'UriLocation',
          },
          assemblyNames: ['assembly'], // Default assembly name
        }

        config.aggregateTextSearchAdapters.push(adapter)

        console.log(`Successfully indexed ${file}`)
      } catch (error) {
        console.error(`Error indexing ${file}:`, error)
        process.exit(1)
      }
    }

    if (!dryrun) {
      writeConf(config, outputPath)
      console.log(`Updated config at ${outputPath}`)
    }
  }

  async indexFromConfig(options: {
    outputPath: string
    tracks?: string
    attributes: string
    assemblies?: string
    force: boolean
    quiet: boolean
    perTrack: boolean
    exclude: string
    prefixSize?: number
    dryrun: boolean
  }) {
    const {
      outputPath,
      tracks,
      attributes,
      assemblies,
      force,
      quiet,
      perTrack,
      exclude,
      prefixSize,
      dryrun,
    } = options

    if (!fs.existsSync(outputPath)) {
      console.error(`Error: Config file not found at ${outputPath}`)
      process.exit(1)
    }

    const config = readConf(outputPath)

    if (!config.tracks || config.tracks.length === 0) {
      console.error('Error: No tracks found in config')
      process.exit(1)
    }

    const tracksToIndex = tracks
      ? tracks.split(',').map(t => t.trim())
      : config.tracks.map(t => t.trackId)

    const assembliesToIndex = assemblies
      ? assemblies.split(',').map(a => a.trim())
      : config.assemblies?.map(a => a.name) || []

    if (assembliesToIndex.length === 0) {
      console.error('Error: No assemblies found to index')
      process.exit(1)
    }

    const attributesArray = attributes.split(',').map(a => a.trim())
    const excludeArray = exclude.split(',').map(e => e.trim())

    console.log(
      `Indexing ${tracksToIndex.length} tracks for ${assembliesToIndex.length} assemblies...`,
    )

    if (!config.aggregateTextSearchAdapters) {
      config.aggregateTextSearchAdapters = []
    }

    const outDir = path.dirname(outputPath)

    for (const assemblyName of assembliesToIndex) {
      const tracksForAssembly = config.tracks.filter(
        track =>
          tracksToIndex.includes(track.trackId) &&
          track.assemblyNames.includes(assemblyName),
      )

      if (tracksForAssembly.length === 0) {
        console.log(`No tracks found for assembly ${assemblyName}`)
        continue
      }

      if (perTrack) {
        for (const track of tracksForAssembly) {
          await this.indexTrack(track, assemblyName, {
            attributesArray,
            excludeArray,
            prefixSize,
            force,
            quiet,
            dryrun,
            outDir,
            config,
          })
        }
      } else {
        await this.indexAssembly(tracksForAssembly, assemblyName, {
          attributesArray,
          excludeArray,
          prefixSize,
          force,
          quiet,
          dryrun,
          outDir,
          config,
        })
      }
    }

    if (!dryrun) {
      writeConf(config, outputPath)
      console.log(`Updated config at ${outputPath}`)
    }
  }

  async indexTrack(
    track: Track,
    assemblyName: string,
    options: {
      attributesArray: string[]
      excludeArray: string[]
      prefixSize?: number
      force: boolean
      quiet: boolean
      dryrun: boolean
      outDir: string
      config: Config
    },
  ) {
    const {
      attributesArray,
      excludeArray,
      prefixSize,
      force,
      quiet,
      dryrun,
      outDir,
      config,
    } = options

    // @ts-expect-error
    if (!supported(track.adapter)) {
      console.log(
        `Skipping track ${track.trackId}: adapter type ${track.adapter?.type} not supported for indexing`,
      )
      return
    }

    const indexName = `${assemblyName}_${track.trackId}`
    const ixFile = path.join(outDir, `${indexName}.ix`)
    const ixxFile = path.join(outDir, `${indexName}.ixx`)
    const metaFile = path.join(outDir, `${indexName}_meta.json`)

    if (!force && fs.existsSync(ixFile)) {
      console.log(
        `Index already exists for ${track.trackId}, skipping (use --force to overwrite)`,
      )
      return
    }

    if (dryrun) {
      console.log(`Would index track ${track.trackId} -> ${ixFile}`)
      return
    }

    console.log(`Indexing track ${track.trackId}...`)

    try {
      let readable: Readable
      if (
        track.adapter?.type === 'Gff3Adapter' ||
        track.adapter?.type === 'Gff3TabixAdapter'
      ) {
        // @ts-expect-error
        readable = await indexGff3({
          // @ts-expect-error
          config: track.adapter,
          attributesToIndex: attributesArray,
          inLocation: getLoc(
            // @ts-expect-error
            track.adapter.gffLocation || track.adapter.gffGzLocation,
          ),
          outLocation: ixFile,
          typesToExclude: excludeArray,
          quiet,
        })
      } else if (
        track.adapter?.type === 'VcfAdapter' ||
        track.adapter?.type === 'VcfTabixAdapter'
      ) {
        // @ts-expect-error
        readable = await indexVcf({
          // @ts-expect-error
          config: track.adapter,
          attributesToIndex: attributesArray,
          inLocation: getLoc(
            // @ts-expect-error
            track.adapter.vcfLocation || track.adapter.vcfGzLocation,
          ),
          outLocation: ixFile,
          typesToExclude: excludeArray,
          quiet,
        })
      } else {
        console.warn(
          `Warning: Indexing not implemented for adapter type: ${track.adapter?.type}`,
        )
        return
      }

      // @ts-expect-error
      const writableStream = ixIxxStream(ixFile, ixxFile, {
        prefixSize: prefixSize || 6,
      })

      await new Promise<void>((resolve, reject) => {
        // @ts-expect-error
        readable.pipe(writableStream)
        // @ts-expect-error
        writableStream.on('finish', resolve)
        // @ts-expect-error
        writableStream.on('error', reject)
      })

      // Generate metadata
      // const meta = generateMeta(ixFile, ixxFile, attributesArray, excludeArray)
      // fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2))

      // Add to config
      const adapter: TrixTextSearchAdapter = {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: indexName,
        ixFilePath: {
          uri: path.relative(path.dirname(outDir), ixFile),
          locationType: 'UriLocation',
        },
        ixxFilePath: {
          uri: path.relative(path.dirname(outDir), ixxFile),
          locationType: 'UriLocation',
        },
        metaFilePath: {
          uri: path.relative(path.dirname(outDir), metaFile),
          locationType: 'UriLocation',
        },
        assemblyNames: [assemblyName],
      }

      config.aggregateTextSearchAdapters!.push(adapter)

      console.log(`Successfully indexed track ${track.trackId}`)
    } catch (error) {
      console.error(`Error indexing track ${track.trackId}:`, error)
      process.exit(1)
    }
  }

  async indexAssembly(
    tracks: Track[],
    assemblyName: string,
    options: {
      attributesArray: string[]
      excludeArray: string[]
      prefixSize?: number
      force: boolean
      quiet: boolean
      dryrun: boolean
      outDir: string
      config: Config
    },
  ) {
    const {
      attributesArray,
      excludeArray,
      prefixSize,
      force,
      quiet,
      dryrun,
      outDir,
      config,
    } = options

    const indexName = assemblyName
    const ixFile = path.join(outDir, `${indexName}.ix`)
    const ixxFile = path.join(outDir, `${indexName}.ixx`)
    const metaFile = path.join(outDir, `${indexName}_meta.json`)

    if (!force && fs.existsSync(ixFile)) {
      console.log(
        `Index already exists for assembly ${assemblyName}, skipping (use --force to overwrite)`,
      )
      return
    }

    if (dryrun) {
      console.log(`Would index assembly ${assemblyName} -> ${ixFile}`)
      return
    }

    console.log(
      `Indexing assembly ${assemblyName} with ${tracks.length} tracks...`,
    )

    try {
      // For assembly-level indexing, we need to combine all tracks
      const readables: Readable[] = []

      for (const track of tracks) {
        // @ts-expect-error
        if (!supported(track.adapter)) {
          console.log(
            `Skipping track ${track.trackId}: adapter type ${track.adapter?.type} not supported for indexing`,
          )
          continue
        }

        let readable: Readable
        if (
          track.adapter?.type === 'Gff3Adapter' ||
          track.adapter?.type === 'Gff3TabixAdapter'
        ) {
          // @ts-expect-error
          readable = await indexGff3({
            // @ts-expect-error
            config: track.adapter,
            attributesToIndex: attributesArray,
            inLocation: getLoc(
              // @ts-expect-error
              track.adapter.gffLocation || track.adapter.gffGzLocation,
            ),
            outLocation: ixFile,
            typesToExclude: excludeArray,
            quiet,
          })
        } else if (
          track.adapter?.type === 'VcfAdapter' ||
          track.adapter?.type === 'VcfTabixAdapter'
        ) {
          // @ts-expect-error
          readable = await indexVcf({
            // @ts-expect-error
            config: track.adapter,
            attributesToIndex: attributesArray,
            inLocation: getLoc(
              // @ts-expect-error
              track.adapter.vcfLocation || track.adapter.vcfGzLocation,
            ),
            outLocation: ixFile,
            typesToExclude: excludeArray,
            quiet,
          })
        } else {
          continue
        }

        readables.push(readable)
      }

      if (readables.length === 0) {
        console.log(`No supported tracks found for assembly ${assemblyName}`)
        return
      }

      // @ts-expect-error
      const writableStream = ixIxxStream(ixFile, ixxFile, {
        prefixSize: prefixSize || 6,
      })

      // Combine all readable streams
      let currentIndex = 0
      const pipeNext = () => {
        if (currentIndex >= readables.length) {
          // @ts-expect-error
          writableStream.end()
          return
        }

        const readable = readables[currentIndex]!
        currentIndex++

        // @ts-expect-error
        readable.pipe(writableStream, { end: false })
        readable.on('end', pipeNext)
      }

      await new Promise<void>((resolve, reject) => {
        // @ts-expect-error
        writableStream.on('finish', resolve)
        // @ts-expect-error
        writableStream.on('error', reject)
        pipeNext()
      })

      // Generate metadata
      // const meta = generateMeta(ixFile, ixxFile, attributesArray, excludeArray)
      // fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2))

      // Add to config
      const adapter: TrixTextSearchAdapter = {
        type: 'TrixTextSearchAdapter',
        textSearchAdapterId: indexName,
        ixFilePath: {
          uri: path.relative(path.dirname(outDir), ixFile),
          locationType: 'UriLocation',
        },
        ixxFilePath: {
          uri: path.relative(path.dirname(outDir), ixxFile),
          locationType: 'UriLocation',
        },
        metaFilePath: {
          uri: path.relative(path.dirname(outDir), metaFile),
          locationType: 'UriLocation',
        },
        assemblyNames: [assemblyName],
      }

      config.aggregateTextSearchAdapters!.push(adapter)

      console.log(`Successfully indexed assembly ${assemblyName}`)
    } catch (error) {
      console.error(`Error indexing assembly ${assemblyName}:`, error)
      process.exit(1)
    }
  }

  showHelp() {
    console.log(`
${TextIndexNative.description}

USAGE
  $ jbrowse text-index [options]

OPTIONS
  -h, --help                    Show help
  --tracks <tracks>             Specific tracks to index, formatted as comma separated trackIds
  --target <target>             Path to config file in JB2 installation directory to read from
  --out <out>                   Synonym for target
  --attributes <attributes>     Comma separated list of attributes to index (default: Name,ID)
  -a, --assemblies <assemblies> Specify the assembly(ies) to create an index for
  --force                       Overwrite previously existing indexes
  -q, --quiet                   Hide the progress bars
  --perTrack                    If set, creates an index per track
  --exclude <exclude>           Adds gene type to list of excluded types (default: CDS,exon)
  --prefixSize <size>           Specify the prefix size for the ixx index
  --file <file>                 Index specific files (can be used multiple times)
  --dryrun                      Show what would be done without actually doing it

EXAMPLES
${TextIndexNative.examples.join('\n')}
`)
  }
}
