import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'

import {
  createMultiPairPIF,
  createPIF,
  createPIFFromLines,
  getOutputFilename,
  spawnSortProcess,
  waitForProcessClose,
} from './pif-generator.ts'
import {
  parseBedpe,
  parseMaf,
  parseRgfa,
  parseSyriOutput,
} from './parsers/index.ts'
import { recordsToPafLines } from './parsers/to-paf.ts'
import { printHelp } from '../../utils.ts'
import {
  validateFileArgument,
  validateRequiredCommands,
} from '../shared/validators.ts'
import { getReadline } from './file-utils.ts'

function detectFormat(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.syri.out') || lower.endsWith('.syri.out.gz')) {
    return 'syri'
  }
  if (lower.endsWith('.bedpe') || lower.endsWith('.bedpe.gz')) {
    return 'bedpe'
  }
  if (
    lower.endsWith('.gfa') ||
    lower.endsWith('.gfa.gz') ||
    lower.endsWith('.rgfa') ||
    lower.endsWith('.rgfa.gz')
  ) {
    return 'rgfa'
  }
  if (lower.endsWith('.maf') || lower.endsWith('.maf.gz')) {
    return 'maf'
  }
  return 'paf'
}

interface PafPairGroup {
  key: string
  assemblyNames: [string, string]
  lines: string[]
}

async function scanPafForPairs(filename: string) {
  const rl = getReadline(filename)
  const pairMap = new Map<string, PafPairGroup>()
  const assemblyCoverage: {
    qname: string
    tname: string
    alignmentLength: number
  }[] = []

  for await (const line of rl) {
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }
    const cols = line.split('\t')
    if (cols.length < 9) {
      continue
    }
    const qname = cols[0]!
    const tname = cols[5]!

    // Extract assembly name: handles HPRC naming (sample#hap#contig) and
    // other conventions (assembly.chr, assembly:chr)
    const qAsm = qname.split('#')[0]!.split('.')[0]!.split(':')[0]!
    const tAsm = tname.split('#')[0]!.split('.')[0]!.split(':')[0]!

    if (qAsm === tAsm) {
      continue
    }

    const pairKey = [qAsm, tAsm].sort().join('\t')

    let group = pairMap.get(pairKey)
    if (!group) {
      group = {
        key: pairKey,
        assemblyNames: [qAsm, tAsm] as [string, string],
        lines: [],
      }
      pairMap.set(pairKey, group)
    }
    group.lines.push(line)

    const qstart = +cols[2]!
    const qend = +cols[3]!
    assemblyCoverage.push({
      qname: qAsm,
      tname: tAsm,
      alignmentLength: Math.abs(qend - qstart),
    })
  }
  rl.close()

  return { pairMap, assemblyCoverage }
}

function generateSessionSpec(
  assemblyNames: string[],
  trackId: string,
  outputPath: string,
) {
  const views = []
  for (let i = 0; i < assemblyNames.length - 1; i++) {
    views.push({
      type: 'LinearSyntenyView',
      init: {
        views: [
          { assembly: assemblyNames[i] },
          { assembly: assemblyNames[i + 1] },
        ],
        tracks: [trackId],
      },
    })
  }

  const sessionSpec = { views }
  fs.writeFileSync(outputPath, JSON.stringify(sessionSpec, null, 2))
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
    'all-vs-all': {
      type: 'boolean',
      description:
        'Scan PAF file for all unique query/target assemblies, auto-order them, and generate multi-pair PIF.',
    },
    session: {
      type: 'boolean',
      description:
        'Emit a .json session spec file alongside the PIF, loadable via ?session=url.',
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
    '$ jbrowse make-pif multi.paf --all-vs-all',
    '$ jbrowse make-pif input.paf --session',
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
  const allVsAll = flags['all-vs-all'] ?? false
  const emitSession = flags.session ?? false
  const outputFile = getOutputFilename(file, out)

  if (allVsAll && format === 'paf') {
    const { pairMap, assemblyCoverage } = await scanPafForPairs(file!)

    // Use computeGenomeOrdering-style greedy ordering
    const genomeSet = new Set<string>()
    for (const { qname, tname } of assemblyCoverage) {
      genomeSet.add(qname)
      genomeSet.add(tname)
    }

    const coverageMatrix = new Map<string, Map<string, number>>()
    for (const { qname, tname, alignmentLength } of assemblyCoverage) {
      let qMap = coverageMatrix.get(qname)
      if (!qMap) {
        qMap = new Map()
        coverageMatrix.set(qname, qMap)
      }
      qMap.set(tname, (qMap.get(tname) ?? 0) + alignmentLength)

      let tMap = coverageMatrix.get(tname)
      if (!tMap) {
        tMap = new Map()
        coverageMatrix.set(tname, tMap)
      }
      tMap.set(qname, (tMap.get(qname) ?? 0) + alignmentLength)
    }

    const genomes = [...genomeSet]
    const ordered: string[] = []
    if (genomes.length <= 2) {
      for (const g of genomes) {
        ordered.push(g)
      }
    } else {
      // Find genome with most total coverage as start
      let startGenome = genomes[0]!
      let maxCov = 0
      for (const [name, targets] of coverageMatrix) {
        let total = 0
        for (const cov of targets.values()) {
          total += cov
        }
        if (total > maxCov) {
          maxCov = total
          startGenome = name
        }
      }

      ordered.push(startGenome)
      const remaining = new Set(genomes.filter(g => g !== startGenome))

      while (remaining.size > 0) {
        const current = ordered[ordered.length - 1]!
        const currentCov = coverageMatrix.get(current)

        let bestNext = ''
        let bestCovVal = -1

        for (const candidate of remaining) {
          const cov = currentCov?.get(candidate) ?? 0
          if (cov > bestCovVal) {
            bestCovVal = cov
            bestNext = candidate
          }
        }

        if (!bestNext) {
          bestNext = [...remaining][0]!
        }

        ordered.push(bestNext)
        remaining.delete(bestNext)
      }
    }

    console.log(`Auto-ordered assemblies: ${ordered.join(', ')}`)

    // Build pair data for all N*(N-1)/2 pairs
    const pairData: { lines: string[]; assemblyNames: [string, string] }[] = []
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = ordered[i]!
        const b = ordered[j]!
        const key = [a, b].sort().join('\t')
        const group = pairMap.get(key)
        if (group) {
          pairData.push({
            lines: group.lines,
            assemblyNames: [a, b],
          })
        }
      }
    }

    const child = spawnSortProcess(outputFile, csi)
    await createMultiPairPIF(pairData, child.stdin, splitThreshold, mergeGap)
    child.stdin.end()
    await waitForProcessClose(child)

    if (emitSession) {
      const trackId = path.basename(outputFile, '.pif.gz')
      const sessionPath = outputFile.replace(/\.pif\.gz$/, '.session.json')
      generateSessionSpec(ordered, trackId, sessionPath)
      console.log(`Session spec written to ${sessionPath}`)
    }
  } else {
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

    if (emitSession) {
      const trackId = path.basename(outputFile, '.pif.gz')
      const sessionPath = outputFile.replace(/\.pif\.gz$/, '.session.json')
      // For single-pair, derive assembly names from the PAF data
      const assemblyList = assemblies ?? []
      if (assemblyList.length >= 2) {
        generateSessionSpec(assemblyList, trackId, sessionPath)
        console.log(`Session spec written to ${sessionPath}`)
      } else {
        console.warn(
          'Cannot generate session spec without --assemblies flag for non-all-vs-all mode.',
        )
      }
    }
  }
}
