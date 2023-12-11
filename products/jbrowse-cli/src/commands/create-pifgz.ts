import { Args, Flags } from '@oclif/core'
import { sync as commandExistsSync } from 'command-exists'

import { spawn } from 'child_process'
import path from 'path'

import JBrowseCommand from '../base'

export default class CreatePifGz extends JBrowseCommand {
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
      description: `GFF file`,
    }),
    out: Args.string({
      description:
        'Where to write the output file. If unspecified, will be ${file}.pif.gz',
    }),
  }

  static flags = {
    help: Flags.help({ char: 'h' }),
  }

  async run() {
    const {
      args: { file, out },
    } = await this.parse(CreatePifGz)

    if (
      commandExistsSync('sh') &&
      commandExistsSync('sort') &&
      commandExistsSync('grep') &&
      commandExistsSync('tabix') &&
      commandExistsSync('bgzip')
    ) {
      const fn = out || `${path.basename(file, '.paf')}.pif.gz`
      spawn(
        'sh',
        [
          '-c',
          `sort -t"\`printf '\t'\`" -k1,1 -k3,3n ${fn} | bgzip > ${fn}; tabix -s1 -b3 -e4 ${fn}`,
        ],
        {
          env: { ...process.env, LC_ALL: 'C' },
          stdio: 'inherit',
        },
      )
    } else {
      throw new Error(
        'Unable to sort, requires unix type environment with sort, grep, bgzip, tabix',
      )
    }
  }
}
