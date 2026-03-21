import path from 'path'
import { parseArgs } from 'util'

import { printHelp } from '../../utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'

import { gfaToTabix } from './gfa-to-tabix.ts'

const description =
  'Convert a GFA file to tabix-indexed files for runtime synteny queries. ' +
  'Creates two files: pos.bed.gz (position→segment mapping) and ' +
  'segs.bed.gz (segment→position mapping across all genomes).'

export async function run(args?: string[]) {
  return makeGfaTabix(args ?? [])
}

async function makeGfaTabix(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: 'boolean', short: 'h' },
      out: { type: 'string' },
      assemblies: { type: 'string' },
      'chunk-size': { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
  })

  if (values.help) {
    printHelp({
      usage: 'jbrowse make-gfa-tabix <gfa-file>',
      description,
      options: {
        '--out': 'Output prefix (default: input basename)',
        '--assemblies':
          'Comma-separated assembly names to include (default: all)',
        '--chunk-size': 'Number of segments per position chunk (default: 100)',
      },
      examples: [
        'jbrowse make-gfa-tabix pangenome.gfa',
        'jbrowse make-gfa-tabix pangenome.gfa --out pg',
        'jbrowse make-gfa-tabix pangenome.gfa --assemblies ref#1,sample1#1',
      ],
    })
    return
  }

  validateRequiredCommands(['bgzip', 'tabix', 'sort'])

  const gfaFile = positionals[0]
  validateFileArgument(gfaFile, 'make-gfa-tabix', 'GFA')

  const out = typeof values.out === 'string' ? values.out : undefined
  const outputPrefix =
    out ?? path.basename(gfaFile!).replace(/\.gfa(\.gz)?$/, '')

  const assembliesRaw =
    typeof values.assemblies === 'string' ? values.assemblies : undefined
  const assemblies = assembliesRaw?.split(',')
  const chunkSizeRaw =
    typeof values['chunk-size'] === 'string' ? values['chunk-size'] : undefined
  const chunkSize = chunkSizeRaw ? +chunkSizeRaw : undefined

  console.error(`Converting ${gfaFile} to tabix-indexed files...`)

  const stats = await gfaToTabix(gfaFile!, outputPrefix, {
    assemblies,
    chunkSize,
  })

  console.error(`Done.`)
  console.error(`  Segments: ${stats.segmentCount}`)
  console.error(`  Paths: ${stats.pathCount}`)
  console.error(`  Genomes: ${stats.genomes.join(', ')}`)
  console.error(`  Output: ${stats.posFile}, ${stats.segsFile}`)
}
