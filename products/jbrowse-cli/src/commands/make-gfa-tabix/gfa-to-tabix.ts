import { execSync, spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import type { ChildProcess } from 'child_process'

import { getReadline } from '../make-pif/file-utils.ts'

interface PathStep {
  segOrd: number
  orient: string
  segLen: number
}

interface PathInfo {
  name: string
  sample: string
  steps: PathStep[]
}

const complement: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  a: 't',
  t: 'a',
  c: 'g',
  g: 'c',
  N: 'N',
  n: 'n',
}

function revcomp(seq: string) {
  let result = ''
  for (let i = seq.length - 1; i >= 0; i--) {
    result += complement[seq[i]!] ?? 'N'
  }
  return result
}

function getSegSequence(
  segOrd: number,
  orient: string,
  ordToSegId: Map<number, string>,
  segmentSequences: Map<string, string>,
) {
  const segId = ordToSegId.get(segOrd) ?? ''
  const seq = segmentSequences.get(segId) ?? ''
  return orient === '-' ? revcomp(seq) : seq
}

// Compute cs tag for a bubble between two shared anchors.
// refSeq = concatenated ref-only segment sequences
// querySeq = concatenated query-only segment sequences
function computeBubbleCs(refSeq: string, querySeq: string) {
  if (refSeq.length === 0 && querySeq.length === 0) {
    return ''
  }
  if (refSeq.length === 0) {
    return `+${querySeq.toLowerCase()}`
  }
  if (querySeq.length === 0) {
    return `-${refSeq.toLowerCase()}`
  }
  // Both have sequence: compare base-by-base if same length
  if (refSeq.length === querySeq.length) {
    return baseByBaseCs(refSeq, querySeq)
  }
  // Different lengths: emit as deletion + insertion
  return `-${refSeq.toLowerCase()}+${querySeq.toLowerCase()}`
}

// Base-by-base comparison producing cs string
function baseByBaseCs(refSeq: string, querySeq: string) {
  let cs = ''
  let matchRun = 0
  for (let i = 0; i < refSeq.length; i++) {
    const r = refSeq[i]!.toUpperCase()
    const q = querySeq[i]!.toUpperCase()
    if (r === q) {
      matchRun++
    } else {
      if (matchRun > 0) {
        cs += `:${matchRun}`
        matchRun = 0
      }
      cs += `*${r.toLowerCase()}${q.toLowerCase()}`
    }
  }
  if (matchRun > 0) {
    cs += `:${matchRun}`
  }
  return cs
}

interface AlnBlock {
  refStart: number
  refEnd: number
  queryStart: number
  queryEnd: number
  strand: number
  cs: string
}

// Compute pairwise alignment blocks between ref path and query path
// using shared segment anchors from the graph
function computePairwiseAlignments(
  refPath: PathInfo,
  queryPath: PathInfo,
  ordToSegId: Map<number, string>,
  segmentSequences: Map<string, string>,
) {
  // Build ordinal→step index for ref path (with cumulative offset)
  const refByOrd = new Map<
    number,
    { offset: number; segLen: number; orient: string; stepIdx: number }
  >()
  let refOffset = 0
  for (let i = 0; i < refPath.steps.length; i++) {
    const step = refPath.steps[i]!
    refByOrd.set(step.segOrd, {
      offset: refOffset,
      segLen: step.segLen,
      orient: step.orient,
      stepIdx: i,
    })
    refOffset += step.segLen
  }

  // Build ordinal→step index for query path
  const queryByOrd = new Map<
    number,
    { offset: number; segLen: number; orient: string; stepIdx: number }
  >()
  let queryOffset = 0
  for (let i = 0; i < queryPath.steps.length; i++) {
    const step = queryPath.steps[i]!
    queryByOrd.set(step.segOrd, {
      offset: queryOffset,
      segLen: step.segLen,
      orient: step.orient,
      stepIdx: i,
    })
    queryOffset += step.segLen
  }

  // Find shared ordinals, sorted by ref step index
  const shared: {
    segOrd: number
    refOffset: number
    refLen: number
    refOrient: string
    refStepIdx: number
    queryOffset: number
    queryLen: number
    queryOrient: string
    queryStepIdx: number
  }[] = []
  for (const [ord, rInfo] of refByOrd) {
    const qInfo = queryByOrd.get(ord)
    if (qInfo) {
      shared.push({
        segOrd: ord,
        refOffset: rInfo.offset,
        refLen: rInfo.segLen,
        refOrient: rInfo.orient,
        refStepIdx: rInfo.stepIdx,
        queryOffset: qInfo.offset,
        queryLen: qInfo.segLen,
        queryOrient: qInfo.orient,
        queryStepIdx: qInfo.stepIdx,
      })
    }
  }
  shared.sort((a, b) => a.refStepIdx - b.refStepIdx)

  if (shared.length === 0) {
    return []
  }

  // Walk through shared anchors, building alignment blocks with cs
  const blocks: AlnBlock[] = []
  let csParts: string[] = []
  let blockRefStart = -1
  let blockRefEnd = -1
  let blockQueryStart = -1
  let blockQueryEnd = -1
  let blockStrand = 0
  let prevRefStepIdx = -1
  let prevQueryStepIdx = -1

  const emitBlock = () => {
    if (blockRefStart >= 0 && csParts.length > 0) {
      blocks.push({
        refStart: blockRefStart,
        refEnd: blockRefEnd,
        queryStart: blockQueryStart,
        queryEnd: blockQueryEnd,
        strand: blockStrand,
        cs: csParts.join(''),
      })
    }
    csParts = []
    blockRefStart = -1
  }

  for (let si = 0; si < shared.length; si++) {
    const s = shared[si]!
    const strand = s.refOrient === s.queryOrient ? 1 : -1

    if (blockRefStart < 0 || strand !== blockStrand) {
      emitBlock()
      blockRefStart = s.refOffset
      blockRefEnd = s.refOffset + s.refLen
      blockQueryStart = s.queryOffset
      blockQueryEnd = s.queryOffset + s.queryLen
      blockStrand = strand
      csParts.push(`:${s.refLen}`)
      prevRefStepIdx = s.refStepIdx
      prevQueryStepIdx = s.queryStepIdx
      continue
    }

    // Collect ref-only segments between previous and current shared anchor
    let refBubbleSeq = ''
    for (let ri = prevRefStepIdx + 1; ri < s.refStepIdx; ri++) {
      const step = refPath.steps[ri]!
      if (!queryByOrd.has(step.segOrd)) {
        refBubbleSeq += getSegSequence(
          step.segOrd,
          step.orient,
          ordToSegId,
          segmentSequences,
        )
      }
    }

    // Collect query-only segments between previous and current shared anchor
    let queryBubbleSeq = ''
    if (strand === 1) {
      for (let qi = prevQueryStepIdx + 1; qi < s.queryStepIdx; qi++) {
        const step = queryPath.steps[qi]!
        if (!refByOrd.has(step.segOrd)) {
          queryBubbleSeq += getSegSequence(
            step.segOrd,
            step.orient,
            ordToSegId,
            segmentSequences,
          )
        }
      }
    } else {
      // Negative strand: query steps go in reverse order
      for (let qi = prevQueryStepIdx - 1; qi > s.queryStepIdx; qi--) {
        const step = queryPath.steps[qi]!
        if (!refByOrd.has(step.segOrd)) {
          queryBubbleSeq += getSegSequence(
            step.segOrd,
            step.orient,
            ordToSegId,
            segmentSequences,
          )
        }
      }
    }

    const bubbleCs = computeBubbleCs(refBubbleSeq, queryBubbleSeq)
    if (bubbleCs) {
      csParts.push(bubbleCs)
    }

    csParts.push(`:${s.refLen}`)
    blockRefEnd = s.refOffset + s.refLen
    if (strand === 1) {
      blockQueryEnd = s.queryOffset + s.queryLen
    } else {
      blockQueryStart = s.queryOffset
    }
    prevRefStepIdx = s.refStepIdx
    prevQueryStepIdx = s.queryStepIdx
  }
  emitBlock()

  return blocks
}

function spawnSortBgzip(outputFile: string, sortArgs: string) {
  const cmd = `sort ${sortArgs} | bgzip > "${outputFile}"`
  return spawn('sh', ['-c', cmd], {
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['pipe', process.stdout, process.stderr],
  })
}

function waitForClose(child: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    child.on('close', code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Child process exited with code ${code}`))
      }
    })
  })
}

function encodeGenomeFilename(genome: string) {
  return genome.replaceAll('#', '_').replaceAll('/', '_')
}

function writeSegsShard(
  rows: { segOrd: number; line: string }[],
  totalOrdinals: number,
  headerBytes: string,
  outputFile: string,
  idxFile: string,
) {
  const tmpFile = path.join(
    os.tmpdir(),
    `gfa-shard-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )

  rows.sort((a, b) => a.segOrd - b.segOrd)

  const indexOffsets: number[] = []
  let byteOffset = Buffer.byteLength(headerBytes)
  let lastOrd = -1

  const tmpFd = fs.openSync(tmpFile, 'w')
  fs.writeSync(tmpFd, headerBytes)

  for (const row of rows) {
    if (row.segOrd !== lastOrd) {
      while (indexOffsets.length <= row.segOrd) {
        indexOffsets.push(byteOffset)
      }
      lastOrd = row.segOrd
    }
    const lineBytes = Buffer.byteLength(row.line)
    fs.writeSync(tmpFd, row.line)
    byteOffset += lineBytes
  }
  // Fill remaining ordinals up to totalOrdinals
  while (indexOffsets.length <= totalOrdinals) {
    indexOffsets.push(byteOffset)
  }
  fs.closeSync(tmpFd)

  execSync(`bgzip -i "${tmpFile}"`, { stdio: 'inherit' })
  fs.copyFileSync(`${tmpFile}.gz`, outputFile)
  fs.unlinkSync(`${tmpFile}.gz`)
  fs.copyFileSync(`${tmpFile}.gz.gzi`, `${outputFile}.gzi`)
  fs.unlinkSync(`${tmpFile}.gz.gzi`)

  const idxBuf = Buffer.alloc(indexOffsets.length * 8)
  for (let i = 0; i < indexOffsets.length; i++) {
    idxBuf.writeBigUInt64LE(BigInt(indexOffsets[i]!), i * 8)
  }
  fs.writeFileSync(idxFile, idxBuf)
}

export async function gfaToTabix(
  gfaPath: string,
  outputPrefix: string,
  opts: {
    assemblies?: string[]
    chunkSize?: number
    sharded?: boolean
  } = {},
) {
  const { assemblies, chunkSize = 100, sharded = false } = opts
  const rl = getReadline(gfaPath)

  const segmentLengths = new Map<string, number>()
  const segmentSequences = new Map<string, string>()
  const segmentOrdinals = new Map<string, number>()
  let nextOrdinal = 0
  const allPaths: PathInfo[] = []
  const unsupportedLines = new Map<string, number>()

  for await (const line of rl) {
    if (line.startsWith('S\t')) {
      const parts = line.split('\t')
      const name = parts[1]!
      const seq = parts[2]!
      const lnTag = parts.slice(3).find(t => t.startsWith('LN:i:'))
      const length = lnTag ? +lnTag.slice(5) : seq === '*' ? 0 : seq.length

      segmentLengths.set(name, length)
      if (seq !== '*') {
        segmentSequences.set(name, seq)
      }
      if (!segmentOrdinals.has(name)) {
        segmentOrdinals.set(name, nextOrdinal++)
      }
    } else if (line.startsWith('W\t')) {
      const parts = line.split('\t')
      const sample = parts[1]!
      const haplotype = parts[2]!
      const sequence = parts[3]!
      const walkStr = parts[6]!
      const pathName = `${sample}#${haplotype}#${sequence}`

      if (assemblies && !assemblies.includes(`${sample}#${haplotype}`)) {
        continue
      }

      const steps: PathStep[] = []
      const stepRegex = /([><])([^><]+)/g
      let match: RegExpExecArray | null = null
      while ((match = stepRegex.exec(walkStr)) !== null) {
        const segId = match[2]!
        const orient = match[1] === '>' ? '+' : '-'
        const segLen = segmentLengths.get(segId) ?? 0
        let ord = segmentOrdinals.get(segId)
        if (ord === undefined) {
          ord = nextOrdinal++
          segmentOrdinals.set(segId, ord)
        }
        steps.push({ segOrd: ord, orient, segLen })
      }
      allPaths.push({ name: pathName, sample: `${sample}#${haplotype}`, steps })
    } else if (line.startsWith('P\t')) {
      const parts = line.split('\t')
      const rawName = parts[1]!
      const hashIdx = rawName.lastIndexOf('#')
      const sample = hashIdx > 0 ? rawName.slice(0, hashIdx) : rawName
      const sequence = hashIdx > 0 ? rawName.slice(hashIdx + 1) : rawName
      const pathName = `${sample}#${sequence}`

      if (assemblies && !assemblies.includes(sample)) {
        continue
      }

      const steps: PathStep[] = parts[2]!.split(',').map(s => {
        const orient = s.endsWith('-') ? '-' : '+'
        const segId = s.endsWith('+') || s.endsWith('-') ? s.slice(0, -1) : s
        const segLen = segmentLengths.get(segId) ?? 0
        let ord = segmentOrdinals.get(segId)
        if (ord === undefined) {
          ord = nextOrdinal++
          segmentOrdinals.set(segId, ord)
        }
        return { segOrd: ord, orient, segLen }
      })
      allPaths.push({ name: pathName, sample, steps })
    } else if (line.length > 0 && !line.startsWith('#') && !line.startsWith('H\t') && !line.startsWith('L\t')) {
      const lineType = line.split('\t')[0]!
      unsupportedLines.set(lineType, (unsupportedLines.get(lineType) ?? 0) + 1)
    }
  }

  if (unsupportedLines.size > 0) {
    const summary = [...unsupportedLines.entries()]
      .map(([type, count]) => `${type} (${count})`)
      .join(', ')
    console.warn(
      `Warning: skipped unsupported GFA line types: ${summary}. ` +
        'This converter supports S, P, and W lines from GFA 1.0/1.1.',
    )
  }

  if (allPaths.length === 0) {
    console.warn(
      'Warning: no paths (P-lines) or walks (W-lines) found. ' +
        'If this is an rGFA file from minigraph, paths must be ' +
        'generated first (e.g. via minigraph --call).',
    )
  }

  const ordToSegId = new Map<number, string>()
  for (const [name, ord] of segmentOrdinals) {
    ordToSegId.set(ord, name)
  }

  // Write pos.bed.gz: pathName \t start \t end \t minSegOrd \t maxSegOrd
  const posFile = `${outputPrefix}.pos.bed.gz`
  const posProc = spawnSortBgzip(posFile, '-t"$(printf \'\\t\')" -k1,1 -k2,2n')

  const posStdin = posProc.stdin!

  const genomes = [...new Set(allPaths.map(p => p.sample))]
  const headerLine = `#genomes=${genomes.join(',')}\n`
  posStdin.write(headerLine)

  const pathSizes: string[] = []
  for (const p of allPaths) {
    let totalLen = 0
    for (const step of p.steps) {
      totalLen += step.segLen
    }
    pathSizes.push(`${p.name}:${totalLen}`)
  }
  const sizesLine = `#sizes=${pathSizes.join(',')}\n`
  posStdin.write(sizesLine)

  // Build segs rows from paths and write pos chunks
  function buildSegsRowsForPaths(paths: PathInfo[]) {
    const rows: { segOrd: number; line: string }[] = []
    for (const p of paths) {
      let offset = 0
      let chunkStart = 0
      let chunkMinOrd = Infinity
      let chunkMaxOrd = -Infinity
      let stepsInChunk = 0

      for (let i = 0; i < p.steps.length; i++) {
        const step = p.steps[i]!
        const segId = ordToSegId.get(step.segOrd) ?? `${step.segOrd}`
        rows.push({
          segOrd: step.segOrd,
          line: `${step.segOrd}\t${p.name}\t${offset}\t${step.segLen}\t${step.orient}\t${segId}\n`,
        })

        chunkMinOrd = Math.min(chunkMinOrd, step.segOrd)
        chunkMaxOrd = Math.max(chunkMaxOrd, step.segOrd)
        offset += step.segLen
        stepsInChunk++

        if (stepsInChunk >= chunkSize || i === p.steps.length - 1) {
          posStdin.write(
            `${p.name}\t${chunkStart}\t${offset}\t${chunkMinOrd}\t${chunkMaxOrd}\n`,
          )
          chunkStart = offset
          chunkMinOrd = Infinity
          chunkMaxOrd = -Infinity
          stepsInChunk = 0
        }
      }
    }
    return rows
  }

  const headerContent = headerLine + sizesLine
  const segsFile = `${outputPrefix}.segments.gz`
  const segsIdxFile = `${outputPrefix}.segments.idx`
  let manifestFile: string | undefined

  if (sharded) {
    // Process one genome at a time to keep memory O(segments_per_genome)
    const segsDir = `${outputPrefix}_segments`
    fs.mkdirSync(segsDir, { recursive: true })

    const pathsByGenome = new Map<string, PathInfo[]>()
    for (const p of allPaths) {
      if (!pathsByGenome.has(p.sample)) {
        pathsByGenome.set(p.sample, [])
      }
      pathsByGenome.get(p.sample)!.push(p)
    }

    const manifest: {
      genomes: string[]
      files: Record<string, string>
    } = { genomes: [], files: {} }

    for (const [genome, genomePaths] of pathsByGenome) {
      const rows = buildSegsRowsForPaths(genomePaths)
      const encoded = encodeGenomeFilename(genome)
      const shardFile = path.join(segsDir, `${encoded}.segments.gz`)
      const shardIdxFile = path.join(segsDir, `${encoded}.segments.idx`)
      writeSegsShard(rows, nextOrdinal, headerContent, shardFile, shardIdxFile)
      manifest.genomes.push(genome)
      manifest.files[genome] = path.join(
        path.basename(segsDir),
        `${encoded}.segments`,
      )
    }

    manifestFile = `${outputPrefix}.segments.manifest.json`
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
  } else {
    const segsRows = buildSegsRowsForPaths(allPaths)
    writeSegsShard(segsRows, nextOrdinal, headerContent, segsFile, segsIdxFile)
  }

  posStdin.end()
  await waitForClose(posProc)
  execSync(`tabix -c '#' -p bed "${posFile}"`, { stdio: 'inherit' })

  // Step 3: Compute pairwise alignments with cs tags and write aln.bed.gz
  const alnFile = `${outputPrefix}.aln.bed.gz`
  let alnGenerated = false

  if (segmentSequences.size > 0 && allPaths.length >= 2) {
    const alnProc = spawnSortBgzip(
      alnFile,
      '-t"$(printf \'\\t\')" -k1,1 -k2,2n',
    )
    const alnStdin = alnProc.stdin!
    alnStdin.write(headerLine)
    alnStdin.write(sizesLine)

    // Use first path's genome as reference
    const refGenome = allPaths[0]!.sample
    const refPaths = allPaths.filter(p => p.sample === refGenome)

    for (const refPath of refPaths) {
      const { refName: refChrom } = parseGfaPathName(refPath.name)

      // Find query paths on the same chromosome
      for (const queryPath of allPaths) {
        if (queryPath.sample === refGenome) {
          continue
        }
        const { genome: queryGenome, refName: queryChrom } = parseGfaPathName(
          queryPath.name,
        )

        const blocks = computePairwiseAlignments(
          refPath,
          queryPath,
          ordToSegId,
          segmentSequences,
        )

        for (const block of blocks) {
          alnStdin.write(
            `${refPath.name}\t${block.refStart}\t${block.refEnd}\t` +
              `${queryGenome}\t${queryChrom}\t${block.queryStart}\t${block.queryEnd}\t` +
              `${block.strand === -1 ? '-' : '+'}\t${block.cs}\n`,
          )
        }
      }
    }

    alnStdin.end()
    await waitForClose(alnProc)
    execSync(`tabix -c '#' -p bed "${alnFile}"`, { stdio: 'inherit' })
    alnGenerated = true
  }

  return {
    posFile,
    segsFile,
    segsIdxFile,
    manifestFile,
    sharded,
    alnFile: alnGenerated ? alnFile : undefined,
    segmentCount: segmentLengths.size,
    pathCount: allPaths.length,
    genomes,
  }
}

function parseGfaPathName(path: string) {
  const parts = path.split('#')
  if (parts.length >= 3) {
    return {
      genome: parts.slice(0, -1).join('#'),
      refName: parts[parts.length - 1]!,
    }
  }
  return { genome: parts[0]!, refName: parts[1] ?? parts[0]! }
}
