import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { parseArgs } from 'node:util'

import {
  BED_HEADER,
  placeProteinFeatures,
  placementWarnings,
} from 'domains2genome'

import { printHelp } from '../../utils.ts'
import { describeExit, waitForProcessClose } from '../process-utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    out: {
      type: 'string',
      description:
        'Where to write the BED. Defaults to protein_features.bed.gz; the tabix index goes beside it',
    },
    source: {
      type: 'string',
      description:
        'Keep only these analyses, comma separated, as InterProScan names them in its fourth column (e.g. Pfam,SMART)',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description =
    'Places protein features (InterProScan or HMMER domain calls) on the genome through each transcript CDS, as a bgzipped, indexed BED12. The standalone domains2genome package does the same placement without JBrowse'

  const examples = [
    '# Pfam calls from hmmscan --domtblout, on the genes they were called from',
    '$ jbrowse make-protein-features genes.gff3 pfam.domtblout',
    '',
    '# InterProScan TSV or GFF3, Pfam rows only, to a named file',
    '$ jbrowse make-protein-features genes.gff3 interpro.tsv --source Pfam --out pfam.bed.gz',
  ]

  const notes =
    'The calls name each protein by its transcript ID, its CDS protein_id, ' +
    'or its CDS ID (gffread -y, NCBI and Ensembl protein FASTA all match). ' +
    'A feature spanning an intron becomes one BED12 row with a block per ' +
    'exon. Where HMMER hits on one protein overlap by more than half, the ' +
    'lowest E-value is kept, whatever their Pfam clans. ' +
    'Add the file as a track; a multi-row display with rows "transcript" ' +
    "draws each transcript's domains on a row of its own. " +
    'Requires bgzip and tabix on the PATH.'

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage: 'jbrowse make-protein-features <genes.gff3|gtf> <calls> [options]',
      options,
    })
    return
  }

  const [annotation, calls] = positionals
  validateFileArgument(annotation, 'make-protein-features', 'gff3')
  validateFileArgument(calls, 'make-protein-features', 'tsv')
  if (!annotation || !calls) {
    throw new Error(
      'Usage: jbrowse make-protein-features <genes.gff3|gtf> <calls>',
    )
  }
  validateRequiredCommands(['sh', 'bgzip', 'tabix'])

  const outputFile = flags.out ?? 'protein_features.bed.gz'
  const placed = await placeProteinFeatures(annotation, calls, {
    sources: flags.source?.split(',').map(s => s.trim()),
  })

  const partFile = `${outputFile}.part`
  const child = spawn(
    'sh',
    ['-c', 'bgzip > "$1" && tabix -f -p bed "$1"', 'sh', partFile],
    { stdio: ['pipe', process.stdout, process.stderr] },
  )
  const closed = waitForProcessClose(child)
  child.stdin.write(`#${BED_HEADER.join('\t')}\n`)
  for (const line of placed.lines) {
    child.stdin.write(`${line}\n`)
  }
  child.stdin.end()
  const exit = await closed
  if (exit.code !== 0) {
    fs.rmSync(partFile, { force: true })
    fs.rmSync(`${partFile}.tbi`, { force: true })
    throw new Error(`bgzip/tabix exited with ${describeExit(exit)}`)
  }
  fs.renameSync(partFile, outputFile)
  fs.renameSync(`${partFile}.tbi`, `${outputFile}.tbi`)

  for (const warning of placementWarnings(placed)) {
    console.warn(`Warning: ${warning}`)
  }
  const skipped =
    placed.skippedSource > 0
      ? ` (${placed.skippedSource} from other analyses left out)`
      : ''
  console.log(
    `Placed ${placed.lines.length} protein features on ${placed.transcripts} coding transcripts${skipped}\n` +
      `Created ${outputFile} and ${outputFile}.tbi`,
  )
}
