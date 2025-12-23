import { parseArgs } from 'util'

import {
  addAssemblyToConfig,
  enhanceAssembly,
  getAssembly,
  loadOrCreateConfig,
  resolveTargetPath,
  saveConfigAndReport,
} from './utils'
import { debug, printHelp } from '../../utils'

export async function run(args?: string[]) {
  const options = {
    type: {
      type: 'string',
      short: 't',
      description: `type of sequence, by default inferred from sequence file\n\nindexedFasta   An index FASTA (e.g. .fa or .fasta) file;\n               can optionally specify --faiLocation\n\nbgzipFasta     A block-gzipped and indexed FASTA (e.g. .fa.gz or .fasta.gz) file;\n               can optionally specify --faiLocation and/or --gziLocation\n\ntwoBit         A twoBit (e.g. .2bit) file\n\nchromSizes     A chromosome sizes (e.g. .chrom.sizes) file\n\ncustom         Either a JSON file location or inline JSON that defines a custom\n               sequence adapter; must provide --name if using inline JSON`,
      choices: ['indexedFasta', 'bgzipFasta', 'twoBit', 'chromSizes', 'custom'],
    },
    name: {
      type: 'string',
      short: 'n',
      description:
        'Name of the assembly; if not specified, will be guessed using the sequence file name',
    },
    alias: {
      type: 'string',
      short: 'a',
      description:
        'An alias for the assembly name (e.g. "hg38" if the name of the assembly is "GRCh38");\ncan be specified multiple times',
      multiple: true,
    },
    displayName: {
      type: 'string',
      description:
        'The display name to specify for the assembly, e.g. "Homo sapiens (hg38)" while the name can be a shorter identifier like "hg38"',
    },
    faiLocation: {
      type: 'string',
      description: '[default: <fastaLocation>.fai] FASTA index file or URL',
    },
    gziLocation: {
      type: 'string',
      description:
        '[default: <fastaLocation>.gzi] FASTA gzip index file or URL',
    },
    refNameAliases: {
      type: 'string',
      description:
        'Reference sequence name aliases file or URL; assumed to be a tab-separated aliases\nfile unless --refNameAliasesType is specified',
    },
    refNameAliasesType: {
      type: 'string',
      description:
        'Type of aliases defined by --refNameAliases; if "custom", --refNameAliases is either\na JSON file location or inline JSON that defines a custom sequence adapter',
      choices: ['aliases', 'custom'],
      dependsOn: ['refNameAliases'],
    },
    refNameColors: {
      type: 'string',
      description:
        'A comma-separated list of color strings for the reference sequence names; will cycle\nthrough colors if there are fewer colors than sequences',
    },
    target: {
      type: 'string',
      description:
        'path to config file in JB2 installation directory to write out to.\nCreates ./config.json if nonexistent',
    },
    out: {
      type: 'string',
      description: 'synonym for target',
    },
    help: {
      type: 'boolean',
      short: 'h',
      description: 'Display help for command',
    },
    load: {
      type: 'string',
      short: 'l',
      description:
        'Required flag when using a local file. Choose how to manage the data directory. Copy, symlink, or move the data directory to the JBrowse directory. Or use inPlace to modify the config without doing any file operations',
      choices: ['copy', 'symlink', 'move', 'inPlace'],
    },
    skipCheck: {
      type: 'boolean',
      description:
        "Don't check whether or not the sequence file or URL exists or if you are in a JBrowse directory",
    },
    overwrite: {
      type: 'boolean',
      description:
        'Overwrite existing assembly if one with the same name exists',
    },
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Equivalent to `--skipCheck --overwrite`',
    },
  } as const
  const { positionals, values: runFlags } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description = 'Add an assembly to a JBrowse 2 configuration'

  const examples = [
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

  if (runFlags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse add-assembly <sequence> [options]',
      options,
    })
    return
  }

  const argsSequence = positionals[0] || ''
  const output = runFlags.target || runFlags.out || '.'

  debug(`Sequence location is: ${argsSequence}`)

  const target = await resolveTargetPath(output)
  const baseAssembly = await getAssembly({ runFlags, argsSequence, target })
  const assembly = await enhanceAssembly(baseAssembly, runFlags)

  const configContents = await loadOrCreateConfig(target)
  const { config: updatedConfig, wasOverwritten } = await addAssemblyToConfig({
    config: configContents,
    assembly,
    runFlags,
  })

  await saveConfigAndReport({
    config: updatedConfig,
    target,
    assembly,
    wasOverwritten,
  })
}
