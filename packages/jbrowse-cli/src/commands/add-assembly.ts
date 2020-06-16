import { Command, flags } from '@oclif/command'

export default class AddAssembly extends Command {
  static description = 'Add an assembly to a JBrowse 2 configuration'

  static examples = [
    '$ jbrowse add-assembly indexedFasta GRCh38.fa',
    '$ jbrowse add-assembly bgzipFasta myFile.fa.gz --name GRCh38 --alias hg38',
    '$ jbrowse add-assembly twoBit GRCh38.2bit --config path/to/config.json',
    '$ jbrowse add-assembly chromeSizes GRCh38.chrom.sizes',
    '$ jbrowse add-assembly fromConfig GRCh38.config.json',
  ]

  static args = [
    {
      name: 'type',
      required: true,
      description: `type of sequence

indexedFasta   An index FASTA (e.g. .fa or .fasta) file; can optionally specify --faiLocation
bgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file; can optionally specify --faiLocation and/or --gziLocation
twoBit         A twoBit (e.g. .2bit) file
chromSizes     A chromosome sizes (e.g. .chrom.sizes) file
fromConfig     A JBrowse 2 fromConfigAdapter configuration`,
      options: [
        'indexedFasta',
        'bgzipFasta',
        'twoBit',
        'chromSizes',
        'fromConfig',
      ],
    },
    {
      name: 'sequence',
      required: true,
      description: `sequence file or URL

If TYPE is indexedFasta or bgzipFasta, the index file defaults to <location>.fai and can be optionally specified with --faiLocation
If TYPE is bgzipFasta, the gzip index file defaults to <location>.gzi and can be optionally specified with --gziLocation`,
    },
  ]

  static flags = {
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
        'An alias for the assembly name (e.g. "hg38" if the name of the assembly is "GRCh38"); can be specified multiple times',
      multiple: true,
    }),
    faiLocation: flags.string({
      description: '[default: <fastaLocation>.fai] FASTA index file or URL',
    }),
    gziLocation: flags.string({
      description:
        '[default: <fastaLocation>.gzi] FASTA gzip index file or URL',
    }),
    copy: flags.boolean({
      description:
        'Copy the sequence file(s) to the same directory as the config instead of using in place',
      exclusive: ['noCheck'],
    }),
    help: flags.help({ char: 'h' }),
    skipCheck: flags.boolean({
      description: "Don't check whether or not the sequence file or URL exists",
      exclusive: ['copy'],
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
    const { args: runArgs, flags: runFlags } = this.parse(AddAssembly)
    this.log(
      `You are adding a(n) "${runArgs.type}" sequence from "${
        runArgs.sequence
      }" with flags ${JSON.stringify(runFlags)}`,
    )
  }
}
