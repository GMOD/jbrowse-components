import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

import NativeCommand from '../native-base'

import type { Assembly, Config, Sequence } from '../base'

const { rename, copyFile, mkdir, symlink } = fs.promises

function isValidJSON(string: string) {
  try {
    JSON.parse(string)
    return true
  } catch (error) {
    return false
  }
}

export default class AddAssemblyNative extends NativeCommand {
  target = ''

  static description = 'Add an assembly to a JBrowse 2 configuration'

  static examples = [
    '# add assembly to installation in current directory. assumes .fai file also exists, and copies GRCh38.fa and GRCh38.fa.fai to current directory',
    '$ jbrowse add-assembly GRCh38.fa --load copy',
    '',
    '# add assembly to a specific jb2 installation path using --out, and copies the .fa and .fa.fai file to /path/to/jb2',
    '$ jbrowse add-assembly GRCh38.fa --out /path/to/jb2/ --load copy',
    '',
    '# force indexedFasta for add-assembly without relying on file extension',
    '$ jbrowse add-assembly GRCh38.xyz --type indexedFasta --load copy',
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
        type: {
          type: 'string',
          short: 't',
        },
        name: {
          type: 'string',
          short: 'n',
        },
        alias: {
          type: 'string',
          short: 'a',
          multiple: true,
        },
        displayName: {
          type: 'string',
        },
        faiLocation: {
          type: 'string',
        },
        gziLocation: {
          type: 'string',
        },
        refNameAliases: {
          type: 'string',
        },
        refNameAliasesType: {
          type: 'string',
        },
        refNameColors: {
          type: 'string',
        },
        target: {
          type: 'string',
        },
        out: {
          type: 'string',
        },
        load: {
          type: 'string',
          short: 'l',
        },
        skipCheck: {
          type: 'boolean',
          default: false,
        },
        overwrite: {
          type: 'boolean',
          default: false,
        },
        force: {
          type: 'boolean',
          short: 'f',
          default: false,
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
      return
    }

    // Validate load flag options
    if (flags.load && !['copy', 'symlink', 'move', 'inPlace'].includes(flags.load)) {
      console.error('Error: --load must be one of: copy, symlink, move, inPlace')
      process.exit(1)
    }

    // Validate type flag options
    if (flags.type && !['indexedFasta', 'bgzipFasta', 'twoBit', 'chromSizes', 'custom'].includes(flags.type)) {
      console.error('Error: --type must be one of: indexedFasta, bgzipFasta, twoBit, chromSizes, custom')
      process.exit(1)
    }

    // Validate refNameAliasesType dependency
    if (flags.refNameAliasesType && !flags.refNameAliases) {
      console.error('Error: --refNameAliasesType requires --refNameAliases')
      process.exit(1)
    }

    if (flags.refNameAliasesType && !['aliases', 'custom'].includes(flags.refNameAliasesType)) {
      console.error('Error: --refNameAliasesType must be one of: aliases, custom')
      process.exit(1)
    }

    const sequence = positionals[0]
    if (!sequence) {
      console.error('Error: Missing required argument: sequence')
      console.error('Usage: jbrowse add-assembly <sequence> [options]')
      process.exit(1)
    }

    const output = flags.target || flags.out || '.'

    // Check if directory exists
    const exists = (s: string) =>
      new Promise<boolean>(resolve => {
        fs.access(s, fs.constants.F_OK, e => {
          resolve(!e)
        })
      })

    if (!(await exists(output))) {
      const dir = output.endsWith('.json') ? path.dirname(output) : output
      await mkdir(dir, { recursive: true })
    }

    let isDir = false
    try {
      isDir = fs.statSync(output).isDirectory()
    } catch (e) {
      // ignore
    }
    this.target = isDir ? path.join(output, 'config.json') : output

    console.log(`Sequence location is: ${sequence}`)

    // Check if we need to load data
    if (this.needLoadData(sequence) && !flags.load) {
      console.error(
        'Error: Please specify the loading operation for this file with --load copy|symlink|move|inPlace',
      )
      process.exit(110)
    } else if (!this.needLoadData(sequence) && flags.load) {
      console.error(
        'Error: URL detected with --load flag. Please rerun the function without the --load flag',
      )
      process.exit(120)
    }

    const assembly = await this.getAssembly(sequence, flags)
    
    // Add aliases if provided
    if (flags.alias?.length) {
      console.log(`Adding assembly aliases: ${flags.alias}`)
      assembly.aliases = flags.alias
    }

    // Add refName colors if provided
    if (flags.refNameColors) {
      const colors = flags.refNameColors
        .split(',')
        .map(color => color.trim())
      console.log(`Adding refName colors: ${colors}`)
      assembly.refNameColors = colors
    }

    // Handle refNameAliases
    if (flags.refNameAliases) {
      if (flags.refNameAliasesType === 'custom') {
        const refNameAliasesConfig = await this.readInlineOrFileJson<{
          type: string
        }>(flags.refNameAliases)
        if (!refNameAliasesConfig.type) {
          console.error(
            `Error: No "type" specified in refNameAliases adapter "${JSON.stringify(
              refNameAliasesConfig,
            )}"`,
          )
          process.exit(150)
        }
        console.log(
          `Adding custom refNameAliases config: ${JSON.stringify(
            refNameAliasesConfig,
          )}`,
        )
        assembly.refNameAliases = {
          adapter: refNameAliasesConfig,
        }
      } else {
        const refNameAliasesLocation = await this.resolveFileLocation(
          flags.refNameAliases,
          !(flags.skipCheck || flags.force),
          flags.load === 'inPlace',
        )
        console.log(
          `refName aliases file location resolved to: ${refNameAliasesLocation}`,
        )
        assembly.refNameAliases = {
          adapter: {
            type: 'RefNameAliasAdapter',
            location: {
              uri: refNameAliasesLocation,
              locationType: 'UriLocation',
            },
          },
        }
      }
    }

    if (flags.displayName) {
      assembly.displayName = flags.displayName
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

    let configContents: Config

    if (fs.existsSync(this.target)) {
      console.log(`Found existing config file ${this.target}`)
      configContents = {
        ...defaultConfig,
        ...(await this.readJsonFile(this.target)),
      }
    } else {
      console.log(`Creating config file ${this.target}`)
      configContents = { ...defaultConfig }
    }

    if (!configContents.assemblies) {
      configContents.assemblies = []
    }

    const idx = configContents.assemblies.findIndex(
      configAssembly => configAssembly.name === assembly.name,
    )

    if (idx !== -1) {
      console.log(`Found existing assembly ${assembly.name} in configuration`)
      if (flags.overwrite || flags.force) {
        console.log(`Overwriting assembly ${assembly.name} in configuration`)
        configContents.assemblies[idx] = assembly
      } else {
        console.error(
          `Error: Cannot add assembly with name ${assembly.name}, an assembly with that name already exists`,
        )
        process.exit(160)
      }
    } else {
      configContents.assemblies.push(assembly)
    }

    console.log(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, configContents)

    console.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${assembly.name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${this.target}`,
    )
  }

  async getAssembly(sequence: string, flags: any): Promise<Assembly> {
    let sequenceObj: Sequence
    let { name } = flags
    let { type } = flags

    if (type) {
      console.log(`Type is: ${type}`)
    } else {
      type = this.guessSequenceType(sequence)
      console.log(`No type specified, guessing type: ${type}`)
    }
    
    if (name) {
      console.log(`Name is: ${name}`)
    }

    switch (type) {
      case 'indexedFasta': {
        const { skipCheck, force, load, faiLocation } = flags
        let sequenceLocation = await this.resolveFileLocation(
          sequence,
          !(skipCheck || force),
          load === 'inPlace',
        )
        console.log(`FASTA location resolved to: ${sequenceLocation}`)
        let indexLocation = await this.resolveFileLocation(
          faiLocation || `${sequence}.fai`,
          !(skipCheck || force),
          load === 'inPlace',
        )
        console.log(`FASTA index location resolved to: ${indexLocation}`)
        if (!name) {
          name = path.basename(
            sequenceLocation,
            sequenceLocation.endsWith('.fasta') ? '.fasta' : '.fa',
          )
          console.log(`Guessing name: ${name}`)
        }
        const loaded = load
          ? await this.loadData(load, [sequenceLocation, indexLocation])
          : false
        if (loaded) {
          sequenceLocation = path.basename(sequenceLocation)
          indexLocation = path.basename(indexLocation)
        }
        sequenceObj = {
          type: 'ReferenceSequenceTrack',
          trackId: `${name}-ReferenceSequenceTrack`,
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation: {
              uri: sequenceLocation,
              locationType: 'UriLocation',
            },
            faiLocation: { uri: indexLocation, locationType: 'UriLocation' },
          },
        }
        break
      }
      // Add other cases as needed (bgzipFasta, twoBit, chromSizes, custom)
      default:
        throw new Error(`Unsupported sequence type: ${type}`)
    }

    return { name, sequence: sequenceObj }
  }

  guessSequenceType(sequence: string) {
    if (
      sequence.endsWith('.fa') ||
      sequence.endsWith('.fna') ||
      sequence.endsWith('.fasta')
    ) {
      return 'indexedFasta'
    }
    if (
      sequence.endsWith('.fa.gz') ||
      sequence.endsWith('.fna.gz') ||
      sequence.endsWith('.fasta.gz')
    ) {
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
    console.error(
      'Error: Could not determine sequence type automatically, add --type to specify it',
    )
    process.exit(170)
  }

  needLoadData(location: string) {
    let locationUrl: URL | undefined
    try {
      locationUrl = new URL(location)
    } catch (error) {
      // ignore
    }
    if (locationUrl) {
      return false
    }
    return true
  }

  async loadData(load: string, filePaths: string[]) {
    let locationUrl: URL | undefined
    const destination = this.target
    try {
      locationUrl = new URL(filePaths[0]!)
    } catch (error) {
      // ignore
    }

    if (locationUrl) {
      return false
    }
    
    switch (load) {
      case 'copy': {
        await Promise.all(
          filePaths.map(async filePath => {
            if (!filePath) {
              return undefined
            }
            return copyFile(
              filePath,
              path.join(path.dirname(destination), path.basename(filePath)),
            )
          }),
        )
        return true
      }
      case 'symlink': {
        await Promise.all(
          filePaths.map(async filePath => {
            if (!filePath) {
              return undefined
            }
            return symlink(
              path.resolve(filePath),
              path.join(path.dirname(destination), path.basename(filePath)),
            )
          }),
        )
        return true
      }
      case 'move': {
        await Promise.all(
          filePaths.map(async filePath => {
            if (!filePath) {
              return undefined
            }
            return rename(
              filePath,
              path.join(path.dirname(destination), path.basename(filePath)),
            )
          }),
        )
        return true
      }
      case 'inPlace': {
        return false
      }
    }
    return false
  }

  showHelp() {
    console.log(`
${AddAssemblyNative.description}

USAGE
  $ jbrowse add-assembly <sequence> [options]

ARGUMENTS
  sequence  sequence file or URL

OPTIONS
  -h, --help                     Show help
  -t, --type <type>              Type of sequence (indexedFasta, bgzipFasta, twoBit, chromSizes, custom)
  -n, --name <name>              Name of the assembly
  -a, --alias <alias>            An alias for the assembly name (can be specified multiple times)
  --displayName <displayName>    The display name for the assembly
  --faiLocation <faiLocation>    FASTA index file or URL
  --gziLocation <gziLocation>    FASTA gzip index file or URL
  --refNameAliases <file>        Reference sequence name aliases file or URL
  --refNameAliasesType <type>    Type of aliases (aliases, custom)
  --refNameColors <colors>       Comma-separated list of color strings
  --target <target>              Path to config file to write out to
  --out <out>                    Synonym for target
  -l, --load <load>              How to manage the data directory (copy, symlink, move, inPlace)
  --skipCheck                    Don't check whether file or URL exists
  --overwrite                    Overwrite existing assembly with same name
  -f, --force                    Equivalent to --skipCheck --overwrite

EXAMPLES
${AddAssemblyNative.examples.join('\n')}
`)
  }
}