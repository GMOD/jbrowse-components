import { flags } from '@oclif/command'
import fs from 'fs'
import path from 'path'
import JBrowseCommand, {
  Assembly,
  Sequence,
  Config,
  destinationFn,
} from '../base'

const { rename, copyFile, mkdir, symlink } = fs.promises
const { COPYFILE_EXCL } = fs.constants

// https://stackoverflow.com/a/35008327/2129219
function exists(s: string) {
  return new Promise(r => fs.access(s, fs.constants.F_OK, e => r(!e)))
}

function isValidJSON(string: string) {
  try {
    JSON.parse(string)
    return true
  } catch (error) {
    return false
  }
}

export default class AddAssembly extends JBrowseCommand {
  // @ts-ignore
  target: string

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
    '',
    '# add displayName for an assembly',
    '$ jbrowse add-assembly myFile.fa.gz --name hg38 --displayName "Homo sapiens (hg38)"',
    '',
    '# use chrom.sizes file for assembly instead of a fasta file',
    '$ jbrowse add-assembly GRCh38.chrom.sizes --load inPlace',
    '',
    '# add assembly from preconfigured json file, expert option',
    '$ jbrowse add-assembly GRCh38.config.json --load copy',
    '',
    '# add assembly from a 2bit file, also note pointing direct to a URL so no --load flag needed',
    '$ jbrowse add-assembly https://example.com/data/sample.2bit',
    '',
    '# add a bgzip indexed fasta inferred by fa.gz extension. assumes .fa.gz.gzi and .fa.gz.fai files also exists',
    '$ jbrowse add-assembly myfile.fa.gz --load copy',
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
    displayName: flags.string({
      description:
        'The display name to specify for the assembly, e.g. "Homo sapiens (hg38)" while the name can be a shorter identifier like "hg38"',
    }),
    faiLocation: flags.string({
      description: '[default: <fastaLocation>.fai] FASTA index file or URL',
    }),
    gziLocation: flags.string({
      description:
        '[default: <fastaLocation>.gzi] FASTA gzip index file or URL',
    }),
    chromSizesLocation: flags.string({
      description:
        'optional chrom.sizes adapter to use with a twobit adapter, which speeds up initial load of twobit files',
    }),
    subDir: flags.string({
      description:
        'when using --load a file, output to a subdirectory of the target dir',
      default: '',
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
    target: flags.string({
      description:
        'path to config file in JB2 installation directory to write out to.\nCreates ./config.json if nonexistent',
    }),
    out: flags.string({
      description: 'synonym for target',
    }),
    help: flags.help({ char: 'h' }),
    load: flags.string({
      char: 'l',
      description:
        'Required flag when using a local file. Choose how to manage the data directory. Copy, symlink, or move the data directory to the JBrowse directory. Or use inPlace to modify the config without doing any file operations',
      options: ['copy', 'symlink', 'move', 'inPlace'],
    }),
    skipCheck: flags.boolean({
      description:
        "Don't check whether or not the sequence file or URL exists or if you are in a JBrowse directory",
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

  async getAssembly(): Promise<Assembly> {
    let sequence: Sequence
    const { args: runArgs, flags: runFlags } = this.parse(AddAssembly)
    const { sequence: argsSequence } = runArgs as { sequence: string }

    if (this.needLoadData(argsSequence) && !runFlags.load) {
      this.error(
        `Please specify the loading operation for this file with --load copy|symlink|move|inPlace`,
        { exit: 110 },
      )
    } else if (!this.needLoadData(argsSequence) && runFlags.load) {
      this.error(
        `URL detected with --load flag. Please rerun the function without the --load flag`,
        { exit: 120 },
      )
    }

    const {
      load,
      force,
      name,
      subDir,
      faiLocation,
      gziLocation,
      chromSizesLocation,
    } = runFlags
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

    const inPlace = load === 'inPlace'
    const isUrl = (loc?: string) => loc?.match(/^https?:\/\//)
    const getLoc = (loc: string) =>
      isUrl(loc) || inPlace ? loc : path.join(subDir, path.basename(loc))

    let effName
    switch (type) {
      case 'indexedFasta': {
        const effLoc = getLoc(argsSequence)
        const rawIdxLoc = faiLocation || argsSequence + '.fai'
        const effIdxLoc = getLoc(rawIdxLoc)
        effName =
          name ||
          (effLoc.endsWith('.fasta')
            ? path.basename(effLoc, '.fasta')
            : path.basename(effLoc, '.fa'))

        if (load) {
          await this.loadData(load, [argsSequence, rawIdxLoc], subDir, force)
        }

        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${effName}-ReferenceSequenceTrack`,
          adapter: {
            type: 'IndexedFastaAdapter',
            fastaLocation: {
              uri: effLoc,
            },
            faiLocation: {
              uri: effIdxLoc,
            },
          },
        }
        break
      }
      case 'bgzipFasta': {
        const effLoc = getLoc(argsSequence)
        const rawIdxLoc = faiLocation || argsSequence + '.fai'
        const rawGziLoc = gziLocation || argsSequence + '.gzi'
        const effIdxLoc = getLoc(rawIdxLoc)
        const effGziLoc = getLoc(rawGziLoc)
        effName =
          name ||
          (effLoc.endsWith('.fasta.gz')
            ? path.basename(effLoc, '.fasta.gz')
            : path.basename(effLoc, '.fa.gz'))

        if (load) {
          await this.loadData(
            load,
            [argsSequence, rawIdxLoc, rawGziLoc],
            subDir,
            force,
          )
        }

        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${effName}-ReferenceSequenceTrack`,
          adapter: {
            type: 'BgzipFastaAdapter',
            fastaLocation: {
              uri: effLoc,
            },
            faiLocation: {
              uri: effIdxLoc,
            },
            gziLocation: {
              uri: effGziLoc,
            },
          },
        }
        break
      }
      case 'twoBit': {
        const effLoc = getLoc(argsSequence)
        effName = name || path.basename(effLoc, '.2bit')
        if (load) {
          await this.loadData(load, [argsSequence], subDir, force)
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${effName}-ReferenceSequenceTrack`,
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation: {
              uri: effLoc,
            },
          },
        }
        if (chromSizesLocation) {
          const effChromSizesLoc = getLoc(chromSizesLocation)
          if (load) {
            await this.loadData(load, [chromSizesLocation], subDir, force)
          }

          // @ts-ignore
          sequence.adapter.chromSizesLocation = {
            uri: effChromSizesLoc,
          }
        }
        break
      }
      case 'chromSizes': {
        const effLoc = getLoc(argsSequence)
        effName = name || path.basename(effLoc, '.chrom.sizes')
        if (load) {
          await this.loadData(load, [argsSequence], subDir, force)
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${effName}-ReferenceSequenceTrack`,
          adapter: {
            type: 'ChromSizesAdapter',
            chromSizesLocation: {
              uri: effLoc,
            },
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
              { exit: 130 },
            )
          }
          this.debug(`Guessing name: ${name}`)
        }
        effName = name || path.basename(argsSequence, '.json')
        if (!('type' in adapter)) {
          this.error(
            `No "type" specified in sequence adapter "${JSON.stringify(
              adapter,
            )}"`,
            { exit: 140 },
          )
        }
        sequence = {
          type: 'ReferenceSequenceTrack',
          trackId: `${effName}-ReferenceSequenceTrack`,
          adapter,
        }
        break
      }
    }

    return { name: effName, sequence }
  }

  async run() {
    const { args: runArgs, flags: runFlags } = this.parse(AddAssembly)
    const { target, out, subDir } = runFlags

    const output = target || out || '.'

    if (!(await exists(output))) {
      await mkdir(output, { recursive: true })
    }

    const isDir = fs.statSync(output).isDirectory()
    this.target = isDir ? `${output}/config.json` : output
    const configDirectory = path.dirname(this.target)

    if (subDir) {
      const dir = path.join(configDirectory, subDir)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir)
      }
    }
    const { sequence: argsSequence } = runArgs as { sequence: string }
    this.debug(`Sequence location is: ${argsSequence}`)
    const { name } = runFlags

    const assembly = await this.getAssembly()
    if (runFlags.alias && runFlags.alias.length) {
      this.debug(`Adding assembly aliases: ${runFlags.alias}`)
      assembly.aliases = runFlags.alias
    }

    if (runFlags.refNameColors) {
      const colors = runFlags.refNameColors.split(',').map(c => c.trim())
      this.debug(`Adding refName colors: ${colors}`)
      assembly.refNameColors = colors
    }

    if (runFlags.refNameAliases) {
      if (runFlags.refNameAliasesType === 'custom') {
        const refNameAliasesConfig = await this.readInlineOrFileJson(
          runFlags.refNameAliases,
        )
        if (!refNameAliasesConfig.type) {
          this.error(
            `No "type" specified in refNameAliases adapter "${JSON.stringify(
              refNameAliasesConfig,
            )}"`,
            { exit: 150 },
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
          runFlags.load,
          !(runFlags.skipCheck || runFlags.force),
        )
        this.debug(
          `refName aliases file location resolved to: ${refNameAliasesLocation}`,
        )
        assembly.refNameAliases = {
          adapter: {
            type: 'RefNameAliasAdapter',
            location: {
              uri: refNameAliasesLocation,
            },
          },
        }
      }
    }

    if (runFlags.displayName) {
      assembly.displayName = runFlags.displayName
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
      this.debug(`Found existing config file ${this.target}`)
      configContents = {
        ...defaultConfig,
        ...(await this.readJsonFile(this.target)),
      }
    } else {
      this.debug(`Creating config file ${this.target}`)
      configContents = { ...defaultConfig }
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
          { exit: 160 },
        )
      }
    } else {
      configContents.assemblies.push(assembly)
    }

    this.debug(`Writing configuration to file ${this.target}`)
    await this.writeJsonFile(this.target, configContents)

    this.log(
      `${idx !== -1 ? 'Overwrote' : 'Added'} assembly "${assembly.name}" ${
        idx !== -1 ? 'in' : 'to'
      } ${this.target}`,
    )
  }

  guessSequenceType(sequence: string) {
    if (
      sequence.endsWith('.fa') ||
      sequence.endsWith('.fna') ||
      sequence.endsWith('.fasta')
    ) {
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
    return this.error('Could not determine sequence type', { exit: 170 })
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

  async loadData(
    load: string,
    filePaths: string[],
    subDir: string,
    force: boolean,
  ) {
    let locationUrl: URL | undefined
    const configDirectory = path.dirname(this.target)
    try {
      locationUrl = new URL(filePaths[0])
    } catch (error) {
      // ignore
    }

    if (locationUrl) {
      return false
    }

    const loadType =
      (load as 'copy' | 'inPlace' | 'move' | 'symlink' | undefined) || 'inPlace'

    const callbacks = {
      copy: (src: string, dest: string) => {
        return copyFile(path.resolve(src), dest, COPYFILE_EXCL)
      },
      move: (src: string, dest: string) => rename(src, dest),
      symlink: (src: string, dest: string) => symlink(path.resolve(src), dest),
      inPlace: () => {
        /* do nothing */
      },
    }

    await Promise.all(
      filePaths.map(src => {
        return callbacks[loadType](
          src,
          destinationFn(configDirectory, subDir, src, force),
        )
      }),
    )
    return false
  }
}
