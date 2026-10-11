import { spawn } from 'node:child_process'
import { createWriteStream, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { parseArgs } from 'node:util'

import { printHelp, requirePositional } from '../../utils.ts'
import { describeExit, waitForProcessClose } from '../process-utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'
import {
  bedGraphLines,
  chromSizesLines,
  countFeatureStarts,
  densityFormat,
  parseBinSize,
  resolveChromSizes,
} from './density-generator.ts'

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    bin: {
      type: 'string',
      default: '1000',
      description: 'Width of each bin, in bp',
    },
    'chrom-sizes': {
      type: 'string',
      description:
        'Two-column reference name and length table for the assembly the file is on',
    },
    assembly: {
      type: 'string',
      description:
        'FASTA of the assembly the file is on; its .fai supplies the reference lengths, in place of --chrom-sizes',
    },
    out: {
      type: 'string',
      description:
        'Where to write the bigWig. Defaults to <file>.density.bw beside the input',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description =
    'Counts feature starts per bin into a bigWig, which add-track turns into a quantitative track of where the features are'

  const notes =
    'GFF3 counts only top-level features — a line whose attributes have no ' +
    'Parent= — so a gene is one count rather than one per exon. GTF counts its ' +
    'transcript rows where it has any, and every row otherwise. BED and VCF ' +
    'have no parent link to follow, so every record counts.\n\n' +
    'Every base is covered, empty bins as zero, so the zoomed-out summaries a ' +
    'bigWig keeps average over real counts rather than only the bins that hold ' +
    'something.\n\n' +
    'BAM and CRAM are out of scope: read depth is not feature density, and the ' +
    'tools that compute it (bamCoverage, mosdepth) already write it as a ' +
    'bigWig or bedGraph.\n\n' +
    'Requires bedGraphToBigWig (UCSC) on the PATH.'

  const examples = [
    '# writes genes.gff3.density.bw beside the input, in 1kb bins',
    '$ jbrowse make-density genes.gff3.gz --chrom-sizes hg38.chrom.sizes',
    '',
    '# take the reference lengths from the assembly FASTA index instead',
    '$ jbrowse make-density variants.vcf.gz --assembly hg38.fa',
    '',
    '# coarser bins, and a name of your own',
    '$ jbrowse make-density genes.gff3.gz --assembly hg38.fa --bin 10000 --out genes.10kb.bw',
  ]

  const usage = 'jbrowse make-density <file> [options]'

  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage,
      options,
    })
    return
  }

  const file = positionals[0]
  requirePositional(file, 'file', usage)
  // ahead of the bedGraphToBigWig check, so a file this command cannot read
  // says so even where UCSC's tools are not installed
  const format = densityFormat(file)
  validateFileArgument(file, 'make-density', format)
  const binSize = parseBinSize(flags.bin)
  const chromSizes = resolveChromSizes({
    chromSizes: flags['chrom-sizes'],
    assembly: flags.assembly,
  })
  validateRequiredCommands(['bedGraphToBigWig'])

  const outputFile =
    flags.out === undefined
      ? `${file.replace(/\.b?gz$/i, '')}.density.bw`
      : flags.out

  const { bins, records, unknownRefNames } = await countFeatureStarts({
    file,
    format,
    binSize,
    chromSizes,
  })

  if (unknownRefNames.size > 0) {
    const shown = [...unknownRefNames].slice(0, 5).join(', ')
    const rest = unknownRefNames.size - Math.min(unknownRefNames.size, 5)
    console.warn(
      `Warning: skipped records on ${unknownRefNames.size} reference name(s) absent from the reference lengths (${shown}${rest > 0 ? `, and ${rest} more` : ''}). A chr-prefixed file against an unprefixed assembly looks exactly like this.`,
    )
  }

  // A file that yielded nothing is refused rather than written as a flat
  // band, which would read as "no features here" rather than "wrong file"
  const binCount = [...bins.values()].reduce(
    (sum, perRef) => sum + perRef.size,
    0,
  )
  if (binCount === 0) {
    throw new Error(
      `No feature starts found in ${file} on any reference in the given lengths (${records} record(s) read). Is this the right file and assembly?`,
    )
  }

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'jbrowse-density-'))
  try {
    const bedGraph = path.join(tmpDir, 'density.bedGraph')
    // normalized rather than the caller's file, so a .fai (five columns) and a
    // chrom.sizes with stray whitespace both reach bedGraphToBigWig as the two
    // columns it reads
    const sizes = path.join(tmpDir, 'reference.chrom.sizes')
    writeFileSync(sizes, chromSizesLines(chromSizes))
    await pipeline(
      Readable.from(bedGraphLines({ bins, chromSizes, binSize })),
      createWriteStream(bedGraph),
    )
    const child = spawn('bedGraphToBigWig', [bedGraph, sizes, outputFile], {
      stdio: ['ignore', process.stdout, process.stderr],
    })
    const exit = await waitForProcessClose(child)
    if (exit.code !== 0) {
      throw new Error(`bedGraphToBigWig exited with ${describeExit(exit)}`)
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }

  console.log(
    `Created ${outputFile}: ${records} feature start(s) in ${binCount} non-empty ${binSize}bp bin(s)\n\nNext, add it as a track of its own:\n  jbrowse add-track ${outputFile} --load copy`,
  )
}
