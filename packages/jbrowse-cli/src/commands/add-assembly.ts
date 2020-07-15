import { Command, flags } from '@oclif/command'
import { promises as fsPromises } from 'fs'
import * as path from 'path'
import fetch from 'node-fetch'

interface UriLocation {
  uri: string
}

interface IndexedFastaAdapter {
  type: 'IndexedFastaAdapter'
  fastaLocation: UriLocation
  faiLocation: UriLocation
}

interface BgzipFastaAdapter {
  type: 'BgzipFastaAdapter'
  fastaLocation: UriLocation
  faiLocation: UriLocation
  gziLocation: UriLocation
}

interface TwoBitAdapter {
  type: 'TwoBitAdapter'
  twoBitLocation: UriLocation
}

interface ChromeSizesAdapter {
  type: 'ChromSizesAdapter'
  chromSizesLocation: UriLocation
}

interface CustomSequenceAdapter {
  type: string
}

interface RefNameAliasAdapter {
  type: 'RefNameAliasAdapter'
  location: UriLocation
}

interface CustomRefNameAliasAdapter {
  type: string
}

interface Sequence {
  type: 'ReferenceSequenceTrack'
  trackId: string
  adapter:
    | IndexedFastaAdapter
    | BgzipFastaAdapter
    | TwoBitAdapter
    | ChromeSizesAdapter
    | CustomSequenceAdapter
}

interface Assembly {
  name: string
  aliases?: string[]
  sequence: Sequence
  refNameAliases?: {
    adapter: RefNameAliasAdapter | CustomRefNameAliasAdapter
  }
  refNameColors?: string[]
}

interface Config {
  assemblies?: Assembly[]
  configuration?: {}
  connections?: unknown[]
  defaultSession?: {}
  tracks?: unknown[]
}

function isValidJSON(string: string) {
  try {
    JSON.parse(string)
    return true
  } catch (error) {
    return false
  }
}

export default class AddAssembly extends Command {
  static description = 'Add an assembly to a JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-assembly GRCh38.fa',
    '$ jbrowse add-assembly GRCh38.fasta.with.custom.extension.xyz --type indexedFasta',
    '$ jbrowse add-assembly myFile.fa.gz --name GRCh38 --alias hg38',
    '$ jbrowse add-assembly GRCh38.2bit --config path/to/config.json',
    '$ jbrowse add-assembly GRCh38.chrom.sizes',
    '$ jbrowse add-assembly GRCh38.config.json',
  ]

  static args = [
    {
      name: 'sequence',
      required: true,
      description: `sequence file or URL

If TYPE is indexedFasta or bgzipFasta, the index file defaults to <location>.fai
and can be optionally specified with --faiLocation
If TYPE is bgzipFasta, the gzip index file defaults to <location>.gzi and can be
optionally specified with --gziLocation`,
    },
  ]

  static flags = {
    type: flags.string({
      char: 't',
      description: `type of sequence, by default inferred from sequence file

indexedFasta   An index FASTA (e.g. .fa or .fasta) file;
               can optionally specify --faiLocation

bgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file;
               can optionally specify --faiLocation and/or --gziLocation

twoBit         A twoBit (e.g. .2bit) file

chromSizes     A chromosome sizes (e.g. .chrom.sizes) file

custom         Either a JSON file location or inline JSON that defines a custom
               sequence adapter; must provide --name if using inline JSON`,

      options: ['indexedFasta', 'bgzipFasta', 'twoBit', 'chromSizes', 'custom'],
    }),
    config: flags.string({
      char: 'c',
      description:
        'Config file; if the file does not exist, it will be created',
      default: './config.json',
    }),
    name: flags.string({
      char: 'n',
      description:
        'Name of the assembly; if not specified, will be guessed using the sequence file name',
    }),
    alias: flags.string({
      char: 'a',
      description:
        'An alias for the assembly name (e.g. "hg38" if the name of the assembly is "GRCh38");\ncan be specified multiple times',
      multiple: true,
    }),
    faiLocation: flags.string({
      description: '[default: <fastaLocation>.fai] FASTA index file or URL',
    }),
    gziLocation: flags.string({
      description:
        '[default: <fastaLocation>.gzi] FASTA gzip index file or URL',
    }),
    refNameAliases: flags.string({
      description:
        'Reference sequence name aliases file or URL; assumed to be a tab-separated aliases\nfile unless --refNameAliasesType is specified',
    }),
    refNameAliasesType: flags.string({
      description:
        'Type of aliases defined by --refNameAliases; if "custom", --refNameAliases is either\na JSON file location or inline JSON that defines a custom sequence adapter',
      options: ['aliases', 'custom'],
      dependsOn: ['refNameAliases'],
    }),
    refNameColors: flags.string({
      description:
        'A comma-separated list of color strings for the reference sequence names; will cycle\nthrough colors if there are fewer colors than sequences',
    }),
    help: flags.help({ char: 'h' }),
    skipCheck: flags.boolean({
      description: "Don't check whether or not the sequence file or URL exists",
    }),
    overwrite: flags.boolean({
      description:
        'Overwrite existing assembly if one with the same name exists',
    }),
    force: flags.boolean({
      char: 'f',
      description: 'Equivalent to `--skipCheck --overwrite`',
    }),
  }

  async run() {
    await this.checkLocation()
    const { args: runArgs, flags: runFlags } = this.parse(AddAssembly)
    const { sequence: argsSequence } = runArgs as { sequence: string }
    this.debug(`Sequence location is: ${argsSequence}`)
    let { name } = runFlags
    let { type } = runFlags as {
      type:
        | 'indexedFasta'
        | 'bgzipFasta'
        | 'twoBit'
        | 'chromSizes'
        | 'custom'
        | undefined
    }
    if (type) {
      this.debug(`Type is: ${type}`)
    } else {
      type = this.guessSequenceType(argsSequence)
      this.debug(`No type specified, guessing type: ${type}`)
    }
    if (name) {
      this.debug(`Name is: ${name}`)
    }
    let sequence: Sequence
    switch (type) {
      case 'indexedFasta': {
        const sequenceLocation = await this.resolveFileLocation(
          argsSequence,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(`FASTA location resolved to: ${sequenceLocation}`)
        const indexLocation = await this.resolveFileLocation(
          runFlags.faiLocation || `${argsSequence}.fai`,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(`FASTA index location resolved to: ${indexLocation}`)
        if (!name) {
          if (sequenceLocation.endsWith('.fasta')) {
            name = path.basename(sequenceLocation, '.fasta')
          } else {
            name = path.basename(sequenceLocation, '.fa')
          }
          this.debug(`Guessing name: ${name}`)
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation: { uri: sequenceLocation },
            faiLocation: { uri: indexLocation },
          },
        }
        break
      }
      case 'bgzipFasta': {
        const sequenceLocation = await this.resolveFileLocation(
          argsSequence,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(`compressed FASTA location resolved to: ${sequenceLocation}`)
        const indexLocation = await this.resolveFileLocation(
          runFlags.faiLocation || `${sequenceLocation}.fai`,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(
          `compressed FASTA index location resolved to: ${indexLocation}`,
        )
        const bgzipIndexLocation = await this.resolveFileLocation(
          runFlags.gziLocation || `${sequenceLocation}.gzi`,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(`bgzip index location resolved to: ${bgzipIndexLocation}`)
        if (!name) {
          if (sequenceLocation.endsWith('.fasta.gz')) {
            name = path.basename(sequenceLocation, '.fasta.gz')
          } else {
            name = path.basename(sequenceLocation, '.fa.gz')
          }
          this.debug(`Guessing name: ${name}`)
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'BgzipFastaAdapter',
            fastaLocation: { uri: sequenceLocation },
            faiLocation: { uri: indexLocation },
            gziLocation: { uri: bgzipIndexLocation },
          },
        }
        break
      }
      case 'twoBit': {
        const sequenceLocation = await this.resolveFileLocation(
          argsSequence,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(`2bit location resolved to: ${sequenceLocation}`)
        if (!name) {
          name = path.basename(sequenceLocation, '.2bit')
          this.debug(`Guessing name: ${name}`)
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation: { uri: sequenceLocation },
          },
        }
        break
      }
      case 'chromSizes': {
        const sequenceLocation = await this.resolveFileLocation(
          argsSequence,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(`chrome.sizes location resolved to: ${sequenceLocation}`)
        if (!name) {
          name = path.basename(sequenceLocation, '.chrom.sizes')
          this.debug(`Guessing name: ${name}`)
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'ChromSizesAdapter',
            chromSizesLocation: { uri: sequenceLocation },
          },
        }
        break
      }
      case 'custom': {
        const adapter = await this.readInlineOrFileJson(argsSequence)
        this.debug(`Custom adapter: ${JSON.stringify(adapter)}`)
        if (!name) {
          if (isValidJSON(argsSequence)) {
            this.error(
              'Must provide --name when using custom inline JSON sequence',
              { exit: 10 },
            )
          } else {
            name = path.basename(argsSequence, '.json')
          }
          this.debug(`Guessing name: ${name}`)
        }
        if (!('type' in adapter)) {
          this.error(
            `No "type" specified in sequence adapter "${JSON.stringify(
              adapter,
            )}"`,
            { exit: 20 },
          )
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter,
        }
        break
      }
    }

    const assembly: Assembly = { name, sequence }

    if (runFlags.alias && runFlags.alias.length) {
      this.debug(`Adding assembly aliases: ${runFlags.alias}`)
      assembly.aliases = runFlags.alias
    }

    if (runFlags.refNameColors) {
      const colors = runFlags.refNameColors
        .split(',')
        .map(color => color.trim())
      this.debug(`Adding refName colors: ${colors}`)
      assembly.refNameColors = colors
    }

    if (runFlags.refNameAliases) {
      if (
        runFlags.refNameAliasesType &&
        runFlags.refNameAliasesType === 'custom'
      ) {
        const refNameAliasesConfig = await this.readInlineOrFileJson(
          runFlags.refNameAliases,
        )
        if (!refNameAliasesConfig.type) {
          this.error(
            `No "type" specified in refNameAliases adapter "${JSON.stringify(
              refNameAliasesConfig,
            )}"`,
            { exit: 30 },
          )
        }
        this.debug(
          `Adding custom refNameAliases config: ${JSON.stringify(
            refNameAliasesConfig,
          )}`,
        )
        assembly.refNameAliases = {
          adapter: refNameAliasesConfig,
        }
      } else {
        const refNameAliasesLocation = await this.resolveFileLocation(
          runFlags.refNameAliases,
          !runFlags.skipCheck || !runFlags.force,
        )
        this.debug(
          `refName aliases file location resolved to: ${refNameAliasesLocation}`,
        )
        assembly.refNameAliases = {
          adapter: {
            type: 'RefNameAliasAdapter',
            location: { uri: refNameAliasesLocation },
          },
        }
      }
    }

    const defaultConfig: Config = {
      assemblies: [],
      configuration: {},
      connections: [],
      defaultSession: {
        name: 'New Session',
      },
      tracks: [],
    }

    let configContentsJson
    try {
      configContentsJson = await this.readJsonConfig(runFlags.config)
      this.debug(`Found existing config file ${runFlags.config}`)
    } catch (error) {
      this.debug('No existing config file found, using default config')
      configContentsJson = JSON.stringify(defaultConfig)
    }

    let configContents: Config
    try {
      configContents = { ...defaultConfig, ...JSON.parse(configContentsJson) }
    } catch (error) {
      this.error('Could not parse existing config file')
    }

    if (!configContents.assemblies) {
      configContents.assemblies = []
    }
    const idx = configContents.assemblies.findIndex(
      configAssembly => configAssembly.name === assembly.name,
    )
    if (idx !== -1) {
      this.debug(`Found existing assembly ${name} in configuration`)
      if (runFlags.overwrite || runFlags.force) {
        this.debug(`Overwriting assembly ${name} in configuration`)
        configContents.assemblies[idx] = assembly
      } else {
        this.error(
          `Cannot add assembly with name ${assembly.name}, an assembly with that name already exists`,
          { exit: 40 },
        )
      }
    } else {
      configContents.assemblies.push(assembly)
    }

    this.debug(`Writing configuration to file ${runFlags.config}`)
    await fsPromises.writeFile(
      runFlags.config,
      JSON.stringify(configContents, undefined, 2),
    )

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${runFlags.config}`,
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

  guessSequenceType(sequence: string) {
    if (sequence.endsWith('.fa') || sequence.endsWith('.fasta')) {
      return 'indexedFasta'
    }
    if (sequence.endsWith('.fa.gz') || sequence.endsWith('.fasta.gz')) {
      return 'bgzipFasta'
    }
    if (sequence.endsWith('.2bit')) {
      return 'twoBit'
    }
    if (sequence.endsWith('.chrom.sizes')) {
      return 'chromSizes'
    }
    if (sequence.endsWith('.json')) {
      return 'custom'
    }
    if (isValidJSON(sequence)) {
      return 'custom'
    }
    return this.error('Could not determine sequence type', { exit: 80 })
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
        result = JSON.parse(resultJSON)
      } catch (err) {
        this.error(`Not valid inline JSON or JSON file ${inlineOrFileName}`, {
          exit: 100,
        })
      }
    }
    return result
  }

  async readJsonConfig(location: string) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      const response = await fetch(locationUrl)
      return response.json()
    }
    return fsPromises.readFile(location, { encoding: 'utf8' })
  }
}
