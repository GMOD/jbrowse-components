import { getReadline } from '../file-utils.ts'

import type { PAFLikeRecord } from './syri-parser.ts'

interface PathStep {
  seg: string
  orient: string
}

// Parses GFA (P-lines or W-lines) and extracts pairwise synteny by
// walking shared segments between genome paths.
//
// Algorithm:
// 1. Parse all S-lines to get segment lengths
// 2. Parse P-lines (GFA1) or W-lines (GFA1.1+) to get per-genome paths
// 3. For each pair of genomes, walk both paths simultaneously
// 4. Shared segments in the same order → synteny blocks
// 5. Merge adjacent shared segments into larger blocks
export async function parseRgfa(
  filename: string,
  assemblies?: string[],
  pairMode: 'adjacent' | 'all' = 'adjacent',
): Promise<PAFLikeRecord[]> {
  const rl = getReadline(filename)

  const segments = new Map<string, number>()
  const genomePaths = new Map<string, { name: string; steps: PathStep[] }[]>()

  for await (const line of rl) {
    if (line.startsWith('S\t')) {
      const parts = line.split('\t')
      const name = parts[1]!
      const seq = parts[2]!
      const seqLen = seq === '*' ? 0 : seq.length
      const lnTag = parts.slice(3).find(t => t.startsWith('LN:i:'))
      segments.set(name, lnTag ? +lnTag.slice(5) : seqLen)
    } else if (line.startsWith('W\t')) {
      // W <sample> <hap> <seq> <start> <end> <walk>
      const parts = line.split('\t')
      const sampleName = parts[1]!
      const hapIndex = parts[2]!
      const seqName = parts[3]!
      const walkStr = parts[6]!

      const steps: PathStep[] = []
      const stepRegex = /([><])([^><]+)/g
      let match: RegExpExecArray | null = null
      while ((match = stepRegex.exec(walkStr)) !== null) {
        steps.push({
          seg: match[2]!,
          orient: match[1] === '>' ? '+' : '-',
        })
      }

      const key = `${sampleName}#${hapIndex}`
      let pathList = genomePaths.get(key)
      if (!pathList) {
        pathList = []
        genomePaths.set(key, pathList)
      }
      pathList.push({ name: `${key}#${seqName}`, steps })
    } else if (line.startsWith('P\t')) {
      const parts = line.split('\t')
      const pathName = parts[1]!
      const steps: PathStep[] = parts[2]!.split(',').map(s => ({
        seg: s.endsWith('+') || s.endsWith('-') ? s.slice(0, -1) : s,
        orient: s.endsWith('-') ? '-' : '+',
      }))

      // Group by genome name (part before last # or full name)
      const hashIdx = pathName.lastIndexOf('#')
      const genomeName = hashIdx > 0 ? pathName.slice(0, hashIdx) : pathName
      let pathList = genomePaths.get(genomeName)
      if (!pathList) {
        pathList = []
        genomePaths.set(genomeName, pathList)
      }
      pathList.push({ name: pathName, steps })
    }
  }
  rl.close()

  // Filter to requested assemblies
  const genomeNames = assemblies ?? [...genomePaths.keys()]
  const filteredGenomes = genomeNames.filter(n => genomePaths.has(n))

  if (filteredGenomes.length < 2) {
    return []
  }

  // Generate pairs
  const pairs: [string, string][] = []
  if (pairMode === 'adjacent') {
    for (let i = 0; i < filteredGenomes.length - 1; i++) {
      pairs.push([filteredGenomes[i]!, filteredGenomes[i + 1]!])
    }
  } else {
    for (let i = 0; i < filteredGenomes.length; i++) {
      for (let j = i + 1; j < filteredGenomes.length; j++) {
        pairs.push([filteredGenomes[i]!, filteredGenomes[j]!])
      }
    }
  }

  const records: PAFLikeRecord[] = []

  for (const [genomeA, genomeB] of pairs) {
    const pathsA = genomePaths.get(genomeA)!
    const pathsB = genomePaths.get(genomeB)!

    // For each path in A, find the best matching path in B
    // (same chromosome/sequence if naming convention allows)
    for (const pA of pathsA) {
      for (const pB of pathsB) {
        const pairRecords = extractSyntenyFromPaths(
          pA.name,
          pA.steps,
          pB.name,
          pB.steps,
          segments,
        )
        for (const r of pairRecords) {
          records.push(r)
        }
      }
    }
  }

  return records
}

function extractSyntenyFromPaths(
  nameA: string,
  pathA: PathStep[],
  nameB: string,
  pathB: PathStep[],
  segments: Map<string, number>,
): PAFLikeRecord[] {
  // Build segment → position index for path B
  const segPosB = new Map<string, { offset: number; len: number; orient: string }>()
  let totalLenB = 0
  for (const step of pathB) {
    const len = segments.get(step.seg) ?? 0
    segPosB.set(step.seg, { offset: totalLenB, len, orient: step.orient })
    totalLenB += len
  }

  // Walk path A, merge consecutive shared segments into synteny blocks
  const blocks: {
    startA: number
    endA: number
    startB: number
    endB: number
    strand: string
    sharedBp: number
  }[] = []

  let offsetA = 0
  let blockStartA = -1
  let blockEndA = -1
  let blockStartB = -1
  let blockEndB = -1
  let blockStrand = '+'
  let sharedBp = 0

  for (const step of pathA) {
    const len = segments.get(step.seg) ?? 0
    const bPos = segPosB.get(step.seg)

    if (bPos) {
      const strandMatch = step.orient === bPos.orient
      const strand = strandMatch ? '+' : '-'

      if (blockStartA === -1) {
        blockStartA = offsetA
        blockEndA = offsetA + len
        blockStartB = bPos.offset
        blockEndB = bPos.offset + len
        blockStrand = strand
        sharedBp = len
      } else if (strand === blockStrand) {
        blockEndA = offsetA + len
        blockStartB = Math.min(blockStartB, bPos.offset)
        blockEndB = Math.max(blockEndB, bPos.offset + len)
        sharedBp += len
      } else {
        blocks.push({
          startA: blockStartA, endA: blockEndA,
          startB: blockStartB, endB: blockEndB,
          strand: blockStrand, sharedBp,
        })
        blockStartA = offsetA
        blockEndA = offsetA + len
        blockStartB = bPos.offset
        blockEndB = bPos.offset + len
        blockStrand = strand
        sharedBp = len
      }
    } else {
      if (blockStartA !== -1) {
        blocks.push({
          startA: blockStartA, endA: blockEndA,
          startB: blockStartB, endB: blockEndB,
          strand: blockStrand, sharedBp,
        })
        blockStartA = -1
        sharedBp = 0
      }
    }
    offsetA += len
  }
  if (blockStartA !== -1) {
    blocks.push({
      startA: blockStartA, endA: blockEndA,
      startB: blockStartB, endB: blockEndB,
      strand: blockStrand, sharedBp,
    })
  }

  const totalLenA = offsetA

  return blocks.map(b => ({
    qname: nameA,
    qlen: String(totalLenA),
    qstart: b.startA,
    qend: b.endA,
    strand: b.strand,
    tname: nameB,
    tlen: String(totalLenB),
    tstart: b.startB,
    tend: b.endB,
    numMatches: b.sharedBp,
    blockLen: Math.max(b.endA - b.startA, b.endB - b.startB),
  }))
}
