import { spawn } from 'child_process'
import { parseArgs } from 'util'

import { sync as commandExistsSync } from 'command-exists'

import NativeCommand from '../native-base'

export default class SortBedNative extends NativeCommand {
  static description =
    'Helper utility to sort BED files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep'

  static examples = [
    '# sort bed and pipe to bgzip',
    '$ jbrowse sort-bed input.bed | bgzip > sorted.bed.gz',
    '$ tabix sorted.bed.gz',
  ]

  async run(args?: string[]) {
    const { values: flags, positionals } = parseArgs({
      args,
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
      return
    }

    const file = positionals[0]
    if (!file) {
      console.error('Error: Missing required argument: file')
      console.error('Usage: jbrowse sort-bed <file>')
      process.exit(1)
    }

    if (
      commandExistsSync('sh') &&
      commandExistsSync('sort') &&
      commandExistsSync('grep')
    ) {
      // this command comes from the tabix docs http://www.htslib.org/doc/tabix.html
      // BED files use columns 1,2 (0-based) for chromosome and start position
      spawn(
        'sh',
        [
          '-c',
          `(grep "^#" "${file}"; grep -v "^#" "${file}" | sort -t"\`printf '\t'\`" -k1,1 -k2,2n)`,
        ],
        {
          env: { ...process.env, LC_ALL: 'C' },
          stdio: 'inherit',
        },
      )
    } else {
      console.error(
        'Error: Unable to sort, requires unix type environment with sort, grep',
      )
      process.exit(1)
    }
  }

  showHelp() {
    console.log(`
${SortBedNative.description}

USAGE
  $ jbrowse sort-bed <file>

ARGUMENTS
  file  BED file

OPTIONS
  -h, --help  Show help

EXAMPLES
${SortBedNative.examples.join('\n')}
`)
  }
}
