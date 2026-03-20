import { parseArgs } from 'util'

import {
  createPIF,
  createPIFFromLines,
  getOutputFilename,
  spawnSortProcess,
  waitForProcessClose,
} from './pif-generator.ts'
import { parseBedpe, parseMaf, parseRgfa, parseSyriOutput } from './parsers/index.ts'
import { recordsToPafLines } from './parsers/to-paf.ts'
import { printHelp } from '../../utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'

function detectFormat(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.syri.out') || lower.endsWith('.syri.out.gz')) {
    return 'syri'
  }
  if (lower.endsWith('.bedpe') || lower.endsWith('.bedpe.gz')) {
    return 'bedpe'
  }
  if (lower.endsWith('.gfa') || lower.endsWith('.gfa.gz') || lower.endsWith('.rgfa') || lower.endsWith('.rgfa.gz')) {
    return 'rgfa'
  }
  if (lower.endsWith('.maf') || lower.endsWith('.maf.gz')) {
    return 'maf'
  }
  return 'paf'
}

export async function run(args?: string[]) {
  const options = {
    help: {
      type: 'boolean',
      short: 'h',
    },
    out: {
      type: 'string',
      description:
        'Where to write the output file. will write ${file}.pif.gz and ${file}.pif.gz.tbi',
    },
    csi: {
      type: 'boolean',
      description: 'Create a CSI index for the PIF file instead of TBI',
    },
    'split-threshold': {
      type: 'string',
      description:
        'Split alignments at indels larger than this threshold (in bp). Set to 0 to disable splitting.',
      default: '10000',
    },
    'merge-gap': {
      type: 'string',
      description:
        'Gap threshold for merging adjacent same-type alignments into structural summary blocks (in bp). Set to 0 to disable structural tier.',
      default: '50000',
    },
    format: {
      type: 'string',
      description:
        'Input file format. Auto-detected from extension if not specified. Options: paf, syri, bedpe, rgfa, maf',
    },
    assemblies: {
      type: 'string',
      description:
        'Comma-separated list of assembly names to extract (for rgfa/maf). Controls ordering.',
    },
    pairs: {
      type: 'string',
      description:
        'Pair generation mode for multi-genome inputs: "adjacent" (default, N-1 pairs) or "all" (N*(N-1)/2 pairs)',
      default: 'adjacent',
    },
  } as const
  const { values: flags, positionals } = parseArgs({
    args,
    options,
    allowPositionals: true,
  })

  const description =
    'creates pairwise indexed PAF (PIF), with bgzip and tabix. Accepts PAF, SyRI output, BEDPE, rGFA, and MAF formats.'

  const examples = [
    '$ jbrowse make-pif input.paf',
    '$ jbrowse make-pif input.paf --out output.pif.gz',
    '$ jbrowse make-pif alignment.syri.out --format syri',
    '$ jbrowse make-pif pangenome.gfa --format rgfa --assemblies col-0,ler,cvi',
    '$ jbrowse make-pif alignment.maf --format maf --assemblies hg38,mm39',
    '$ jbrowse make-pif pairs.bedpe --format bedpe',
  ]

  if (flags.help) {
    printHelp({
      description,
      examples,
      usage: 'jbrowse make-pif <file> [options]',
      options,
    })
    return
  }

  const file = positionals[0]
  validateFileArgument(file, 'make-pif', 'file')
  validateRequiredCommands(['sh', 'sort', 'grep', 'tabix', 'bgzip'])

  const { out, csi = false } = flags
  const splitThreshold = Number(flags['split-threshold'])
  const mergeGap = Number(flags['merge-gap'])
  const format = flags.format || detectFormat(file!)
  const assemblies = flags.assemblies?.split(',')
  const pairMode = (flags.pairs || 'adjacent') as 'adjacent' | 'all'
  const outputFile = getOutputFilename(file, out)

  const child = spawnSortProcess(outputFile, csi)

  if (format === 'paf') {
    await createPIF(file, child.stdin, splitThreshold, mergeGap)
  } else {
    let records
    if (format === 'syri') {
      records = await parseSyriOutput(file!)
    } else if (format === 'bedpe') {
      records = await parseBedpe(file!)
    } else if (format === 'rgfa') {
      records = await parseRgfa(file!, assemblies, pairMode)
    } else if (format === 'maf') {
      records = await parseMaf(file!, assemblies)
    } else {
      throw new Error(`Unknown format: ${format}`)
    }

    const pafLines = recordsToPafLines(records)
    await createPIFFromLines(pafLines, child.stdin, splitThreshold, mergeGap)
  }

  child.stdin.end()
  await waitForProcessClose(child)
}
