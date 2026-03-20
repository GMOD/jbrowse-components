import { getReadline } from '../file-utils.ts'

import type { PAFLikeRecord } from './syri-parser.ts'

interface Segment {
  name: string
  length: number
  // rGFA tags: SN=stable name, SO=stable offset, SR=stable rank
  stableName?: string
  stableOffset?: number
}

interface PathStep {
  segmentName: string
  orientation: '+' | '-'
}

interface WalkEntry {
  sampleName: string
  hapIndex: string
  seqName: string
  seqStart: number
  seqEnd: number
  steps: PathStep[]
}

function parseTag(tags: string[], prefix: string) {
  const tag = tags.find(t => t.startsWith(prefix))
  return tag ? tag.slice(prefix.length) : undefined
}

// Parses rGFA and extracts pairwise synteny between genome paths.
// For each pair of genomes, walks both paths and identifies shared segments.
export async function parseRgfa(
  filename: string,
  assemblies?: string[],
  pairMode: 'adjacent' | 'all' = 'adjacent',
): Promise<PAFLikeRecord[]> {
  const rl = getReadline(filename)

  const segments = new Map<string, Segment>()
  const walks: WalkEntry[] = []
  // P-line paths (GFA1 format)
  const paths = new Map<string, PathStep[]>()

  for await (const line of rl) {
    const parts = line.split('\t')
    const recType = parts[0]

    if (recType === 'S') {
      const name = parts[1]!
      const seq = parts[2]!
      const length = seq === '*' ? 0 : seq.length
      const tags = parts.slice(3)

      // Check for LN tag (sequence length) if seq is '*'
      const lnTag = parseTag(tags, 'LN:i:')
      const actualLength = lnTag ? +lnTag : length

      const stableName = parseTag(tags, 'SN:Z:')
      const soTag = parseTag(tags, 'SO:i:')

      segments.set(name, {
        name,
        length: actualLength,
        stableName,
        stableOffset: soTag ? +soTag : undefined,
      })
    } else if (recType === 'W') {
      // W-line: W <sample> <hap> <seq> <start> <end> <walk>
      const sampleName = parts[1]!
      const hapIndex = parts[2]!
      const seqName = parts[3]!
      const seqStart = +parts[4]!
      const seqEnd = +parts[5]!
      const walkStr = parts[6]!

      // Parse walk: >seg1<seg2>seg3 or >seg1>seg2
      const steps: PathStep[] = []
      const stepRegex = /([><])([^><]+)/g
      let match: RegExpExecArray | null = null
      while ((match = stepRegex.exec(walkStr)) !== null) {
        steps.push({
          segmentName: match[2]!,
          orientation: match[1] === '>' ? '+' : '-',
        })
      }

      walks.push({ sampleName, hapIndex, seqName, seqStart, seqEnd, steps })
    } else if (recType === 'P') {
      const pathName = parts[1]!
      const segmentNames = parts[2]!
      const steps: PathStep[] = segmentNames.split(',').map(s => {
        const orient = s.endsWith('+') || s.endsWith('-') ? s.slice(-1) : '+'
        const name = s.endsWith('+') || s.endsWith('-') ? s.slice(0, -1) : s
        return { segmentName: name, orientation: orient as '+' | '-' }
      })
      paths.set(pathName, steps)
    }
  }
  rl.close()

  // Build genome paths from W-lines or P-lines
  const genomePaths = new Map<string, { seqName: string; steps: PathStep[] }[]>()

  if (walks.length > 0) {
    for (const w of walks) {
      const key = `${w.sampleName}#${w.hapIndex}`
      let pathList = genomePaths.get(key)
      if (!pathList) {
        pathList = []
        genomePaths.set(key, pathList)
      }
      pathList.push({ seqName: w.seqName, steps: w.steps })
    }
  } else {
    for (const [name, steps] of paths) {
      genomePaths.set(name, [{ seqName: name, steps }])
    }
  }

  // Filter to requested assemblies
  const genomeNames = assemblies ?? [...genomePaths.keys()]
  const filteredGenomes = genomeNames.filter(n => genomePaths.has(n))

  if (filteredGenomes.length < 2) {
    return []
  }

  // Build segment usage index: segment -> { genome, seqName, offset, orientation }
  const segmentUsage = new Map<
    string,
    { genome: string; seqName: string; offset: number; orientation: string }[]
  >()

  for (const genomeName of filteredGenomes) {
    const pathList = genomePaths.get(genomeName)!
    for (const path of pathList) {
      let offset = 0
      for (const step of path.steps) {
        const seg = segments.get(step.segmentName)
        if (seg) {
          let usages = segmentUsage.get(step.segmentName)
          if (!usages) {
            usages = []
            segmentUsage.set(step.segmentName, usages)
          }
          usages.push({
            genome: genomeName,
            seqName: path.seqName,
            offset,
            orientation: step.orientation,
          })
          offset += seg.length
        }
      }
    }
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
    // Find shared segments between the two genomes
    for (const [, usages] of segmentUsage) {
      const usageA = usages.filter(u => u.genome === genomeA)
      const usageB = usages.filter(u => u.genome === genomeB)

      for (const a of usageA) {
        for (const b of usageB) {
          const seg = segments.get(
            usages[0]!.genome === genomeA
              ? usages.find(u => u.genome === genomeA)!.seqName
              : '',
          )
          const segLen = seg?.length ?? 0
          if (segLen === 0) {
            continue
          }

          const sameOrientation = a.orientation === b.orientation
          records.push({
            qname: `${genomeB}:${b.seqName}`,
            qlen: '0',
            qstart: b.offset,
            qend: b.offset + segLen,
            strand: sameOrientation ? '+' : '-',
            tname: `${genomeA}:${a.seqName}`,
            tlen: '0',
            tstart: a.offset,
            tend: a.offset + segLen,
            numMatches: segLen,
            blockLen: segLen,
          })
        }
      }
    }
  }

  return records
}
