import path from 'path'
import { parseArgs } from 'util'

import { printHelp } from '../../utils.ts'
import {
  validateFileArgument,
} from '../shared/validators.ts'

import { createGfaDatabase, populateFromGfa } from './gfa-to-sqlite.ts'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    out: {
      type: 'string',
      description: 'Output SQLite database path (default: <input>.gfa.db)',
    },
    assemblies: {
      type: 'string',
      description:
        'Comma-separated list of assembly/genome names to include (default: all)',
    },
  } as const

  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description =
    'Converts a GFA file into an indexed SQLite database for runtime querying of graph genome paths and synteny.'

  const examples = [
    '$ jbrowse make-gfa-db pangenome.gfa',
    '$ jbrowse make-gfa-db pangenome.gfa --out pangenome.db',
    '$ jbrowse make-gfa-db pangenome.gfa --assemblies col-0,ler,cvi',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse make-gfa-db <gfa-file> [options]',
      options,
    })
    return
  }

  const inputFile = positionals[0]
  validateFileArgument(inputFile, 'make-gfa-db', 'gfa-file')

  const outputFile = flags.out ?? `${inputFile}.db`
  const assemblies = flags.assemblies?.split(',').map(s => s.trim())

  console.log(`Converting ${inputFile} → ${outputFile}`)

  const db = createGfaDatabase(outputFile)
  const stats = await populateFromGfa(db, inputFile!, assemblies)
  db.close()

  console.log(
    `Done: ${stats.segmentCount} segments, ${stats.pathCount} paths, ${stats.genomes.length} genomes`,
  )
  console.log(`Genomes: ${stats.genomes.join(', ')}`)
  console.log(`Output: ${path.resolve(outputFile)}`)
}
