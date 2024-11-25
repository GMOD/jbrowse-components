import { spawn } from 'child_process'
import { Args, Flags } from '@oclif/core'
import { sync as commandExistsSync } from 'command-exists'

import JBrowseCommand from '../base'

export default class SortGff extends JBrowseCommand {
  static description =
    'Helper utility to sort GFF files for tabix. Moves all lines starting with # to the top of the file, and sort by refname and start position using unix utilities sort and grep'

  static examples = [
    '# sort gff and pipe to bgzip',
    '$ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz',
    '$ tabix sorted.gff.gz',
  ]

  static args = {
    file: Args.string({
      required: true,
      description: 'GFF file',
    }),
  }

  static flags = {
    help: Flags.help({ char: 'h' }),
  }

  async run() {
    const {
      args: { file },
    } = await this.parse(SortGff)

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
          `(grep "^#" "${file}"; grep -v "^#" "${file}" | sort -t"\`printf '\t'\`" -k1,1 -k2,2n)`,
        ],
        {
          env: { ...process.env, LC_ALL: 'C' },
          stdio: 'inherit',
        },
      )
    } else {
      throw new Error(
        'Unable to sort, requires unix type environment with sort, grep',
      )
    }
  }
}
