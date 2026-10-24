import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { parseArgs } from 'node:util'

import { printHelp } from '../../utils.ts'
import { describeExit, waitForProcessClose } from '../process-utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'
import {
  BED_HEADER,
  bedLine,
  bestOfOverlappingHmmerHits,
  findTranscript,
  parseCall,
  projectResidues,
  readCodingTranscripts,
  readLines,
} from './project.ts'

import type { ProteinCall } from './project.ts'

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
    'Places protein features (InterProScan or HMMER domain calls) on the genome through each transcript CDS, as a bgzipped, indexed BED12'

  const examples = [
    '# Pfam calls from hmmscan --domtblout, on the genes they were called from',
    '$ jbrowse make-protein-features genes.gff3 pfam.domtblout',
    '',
    '# InterProScan TSV, Pfam rows only, to a named file',
    '$ jbrowse make-protein-features genes.gff3 interpro.tsv --source Pfam --out pfam.bed.gz',
  ]

  const notes =
    'The calls name each protein by its transcript ID, its CDS protein_id, ' +
    'or its CDS ID (gffread -y, NCBI and Ensembl protein FASTA all match). ' +
    'A feature spanning an intron becomes one BED12 row with a block per ' +
    'exon. Where HMMER hits on one protein overlap by more than half, the ' +
    'lowest E-value is kept, as pfam_scan does. ' +
    'Add the file as a track with disableGeneHeuristic, and name that track ' +
    "in a gene track's proteinFeatures to draw the domains on its " +
    'transcripts. Requires bgzip and tabix on the PATH.'

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

  const sources = flags.source?.split(',').map(s => s.trim().toLowerCase())
  const outputFile = flags.out ?? 'protein_features.bed.gz'

  const { lookup, transcripts } = await readCodingTranscripts(annotation)
  if (transcripts === 0) {
    throw new Error(
      `${annotation} has no CDS rows to place protein features on`,
    )
  }

  const rows: { refName: string; start: number; line: string }[] = []
  const unmatched = new Set<string>()
  let skippedSource = 0
  let pastCds = 0
  const isProtein = (id: string) => findTranscript(lookup, id) !== undefined
  const parsed: ProteinCall[] = []
  for await (const line of readLines(calls)) {
    const call = parseCall(line, isProtein)
    if (!call) {
      continue
    }
    if (sources && !sources.includes(call.source.toLowerCase())) {
      skippedSource++
    } else {
      parsed.push(call)
    }
  }
  for (const call of bestOfOverlappingHmmerHits(parsed)) {
    const transcript = findTranscript(lookup, call.protein)
    if (!transcript) {
      unmatched.add(call.protein)
      continue
    }
    const blocks = projectResidues(transcript, call.start, call.end)
    if (blocks.length === 0) {
      pastCds++
      continue
    }
    rows.push({
      refName: transcript.refName,
      start: blocks[0]!.start,
      line: bedLine(transcript, call, blocks),
    })
  }
  if (rows.length === 0) {
    throw new Error(
      `No protein features in ${calls} matched a transcript in ${annotation}${
        unmatched.size > 0
          ? `; protein names such as ${[...unmatched].slice(0, 3).join(', ')} match no transcript ID, protein_id or CDS ID`
          : ''
      }`,
    )
  }
  rows.sort((a, b) =>
    a.refName === b.refName
      ? a.start - b.start
      : a.refName < b.refName
        ? -1
        : 1,
  )

  const partFile = `${outputFile}.part`
  const child = spawn(
    'sh',
    ['-c', 'bgzip > "$1" && tabix -f -p bed "$1"', 'sh', partFile],
    { stdio: ['pipe', process.stdout, process.stderr] },
  )
  const closed = waitForProcessClose(child)
  child.stdin.write(`#${BED_HEADER.join('\t')}\n`)
  for (const { line } of rows) {
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

  if (unmatched.size > 0) {
    console.warn(
      `Warning: ${unmatched.size} protein(s) match no transcript, e.g. ${[...unmatched].slice(0, 3).join(', ')}`,
    )
  }
  if (pastCds > 0) {
    console.warn(
      `Warning: ${pastCds} feature(s) start past the end of their transcript's CDS; is the annotation the one the proteins came from?`,
    )
  }
  const skipped =
    skippedSource > 0 ? ` (${skippedSource} from other analyses left out)` : ''
  console.log(
    `Placed ${rows.length} protein features on ${transcripts} coding transcripts${skipped}\n` +
      `Created ${outputFile} and ${outputFile}.tbi`,
  )
}
