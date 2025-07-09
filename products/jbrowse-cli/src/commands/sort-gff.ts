import { spawn } from 'child_process'
import { parseArgs } from 'util'

import { sync as commandExistsSync } from 'command-exists'

import NativeCommand from '../native-base'

export default class SortGffNative extends NativeCommand {
  static description =
    'Helper utility to sort GFF files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep'

  static examples = [
    '# sort gff and pipe to bgzip',
    '$ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz',
    '$ tabix sorted.gff.gz',
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
      console.error('Usage: jbrowse sort-gff <file>')
      process.exit(1)
    }

    if (
      commandExistsSync('sh') &&
      commandExistsSync('sort') &&
      commandExistsSync('grep')
    ) {
      // this command comes from the tabix docs http://www.htslib.org/doc/tabix.html
      spawn(
        'sh',
        [
          '-c',
          `(grep "^#" "${file}"; grep -v "^#" "${file}" | sort -t"\`printf '\t'\`" -k1,1 -k4,4n)`,
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
${SortGffNative.description}

USAGE
  $ jbrowse sort-gff <file>

ARGUMENTS
  file  GFF file

OPTIONS
  -h, --help  Show help

EXAMPLES
${SortGffNative.examples.join('\n')}
`)
  }
}