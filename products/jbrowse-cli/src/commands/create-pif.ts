import { Args, Flags } from '@oclif/core'
import { sync as commandExistsSync } from 'command-exists'

import { spawn } from 'child_process'
import path from 'path'

import JBrowseCommand from '../base'

export default class CreatePif extends JBrowseCommand {
  static description =
    'creates pairwise indexed PAF (PIF), with bgzip and tabix'

  static examples = [
    '$ jbrowse create-pifgz input.paf # creates input.pif.gz in same directory',
    '',
    '$ jbrowse create-pifgz input.paf --out output.pif.gz # specify output file, creates output.pif.gz.tbi also',
  ]

  static flags = {
    out: Flags.string({
      description:
        'Where to write the output file. If unspecified, will be ${file}.pif.gz',
    }),
    csi: Flags.string({
      description: 'Create a CSI index for the PIF file instead of TBI',
    }),
    help: Flags.help({ char: 'h' }),
  }
  static args = {
    file: Args.string({
      required: true,
      description: `PAF file as input`,
    }),
  }

  async run() {
    const {
      args: { file },
      flags: { out },
    } = await this.parse(CreatePif)

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
