import { Args } from '@oclif/core'
import { sync as commandExistsSync } from 'command-exists'

import { spawn } from 'child_process'
import JBrowseCommand from '../base'

export default class SortGff extends JBrowseCommand {
  static description = 'Helper utility to sort GFF files for tabix'

  static examples = [
    '# sort gff and pipe to bgzip',
    '$ jbrowse sort-gff input.gff | bgzip > sorted.gff.gz',
    '$ tabix sorted.gff.gz',
  ]

  static args = {
    file: Args.string({
      required: true,
      description: `GFF file`,
    }),
  }

  async run() {
    const {
      args: { file },
    } = await this.parse(SortGff)

    if (commandExistsSync('sort') && commandExistsSync('grep')) {
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
      throw new Error(
        'Unable to sort, requires unix type environment with sort, grep',
      )
    }
  }
}
