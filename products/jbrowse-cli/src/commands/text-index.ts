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
      },
    } = this.parse(TextIndex)
    const outFlag = target || out || '.'
    const confFile = fs.lstatSync(outFlag).isDirectory()
      ? path.join(outFlag, 'config.json')
      : outFlag
    const dir = path.dirname(confFile)
    const config: Config = JSON.parse(fs.readFileSync(confFile, 'utf8'))
    const assembliesToIndex =
      assemblies?.split(',') || config.assemblies?.map(a => a.name) || []
    const adapters = config.aggregateTextSearchAdapters || []
    const trixDir = path.join(dir, 'trix')
    if (!fs.existsSync(trixDir)) {
      fs.mkdirSync(trixDir)
    }

    const attributesToIndex = attributes?.split(',') || []

    for (const asm of assembliesToIndex) {
      const trackConfigs = await this.getConfig(
        confFile,
        asm,
        tracks?.split(','),
      )
      this.log('Indexing assembly ' + asm + '...')
      if (!trackConfigs.length) {
        continue
      }
      const id = asm + '-index'
      const adapterAlreadyFound = adapters.find(
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
        adapters.push({
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
        { ...config, aggregateTextSearchAdapters: adapters },
        null,
        2,
      ),
    )

    this.log('Finished!')
  }

  // This function takes a list of tracks, as well as which attributes to
  // index, and indexes them all into one aggregate index.
  async indexDriver(
    configs: Track[],
    attributes: string[],
    out: string,
    assemblyName: string,
    quiet: boolean,
    include: string[],
    exclude: string[],
  ) {
    const readable = Readable.from(
      this.indexFile(configs, attributes, out, quiet, include, exclude),
    )
    return this.runIxIxx(readable, out, assemblyName)
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

  // Given a readStream of data, indexes the stream into .ix and .ixx files
  // using ixIxx.  The ixIxx executable is required on the system path for
  // users, however tests use a local copy.  Returns a promise around ixIxx
  // completing (or erroring).
  runIxIxx(readStream: Readable, outLocation: string, assembly: string) {
    const ixFilename = path.join(outLocation, 'trix', `${assembly}.ix`)
    const ixxFilename = path.join(outLocation, 'trix', `${assembly}.ixx`)

    return ixIxxStream(readStream, ixFilename, ixxFilename)
  }

  // Function that takes in an array of tracks and returns an array of
  // identifiers stating what will be indexed
  async getConfig(
    configPath: string,
    assemblyName: string,
    trackIds?: string[],
  ) {
    const { tracks } = (await this.readJsonFile(configPath)) as Config
    if (!tracks) {
      throw new Error(
        'No tracks found in config.json. Please add a track before indexing.',
      )
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
      .filter(track => track.assemblyNames.includes(assemblyName))
      .filter(track => supported(track.adapter.type))
  }
}

function supported(type: string) {
  return ['Gff3TabixAdapter', 'GtfTabixAdapter', 'VcfTabixAdapter'].includes(
    type,
  )
}
