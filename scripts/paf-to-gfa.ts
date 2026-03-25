#!/usr/bin/env node
// Creates a simple block-decomposed GFA from a minimap2 PAF alignment.
// Each CIGAR operation (M/I/D) becomes a segment. Shared M segments get
// shared segment IDs so both genomes' paths reference them.
//
// Usage: minimap2 -cx asm5 --cs ref.fa query.fa | node --experimental-strip-types scripts/paf-to-gfa.ts ref_name query_name > output.gfa

import { createInterface } from 'readline'

const refGenome = process.argv[2]
const queryGenome = process.argv[3]

if (!refGenome || !queryGenome) {
  console.error('Usage: minimap2 ... | node --experimental-strip-types scripts/paf-to-gfa.ts <ref_name> <query_name>')
  process.exit(1)
}

interface PafRecord {
  qName: string
  qLen: number
  qStart: number
  qEnd: number
  strand: string
  tName: string
  tLen: number
  tStart: number
  tEnd: number
  cigar: string
}

const records: PafRecord[] = []

const rl = createInterface({ input: process.stdin })

rl.on('line', (line: string) => {
  const cols = line.split('\t')
  // Only use primary alignments
  const tp = cols.find(c => c.startsWith('tp:A:'))
  if (tp && tp !== 'tp:A:P') {
    return
  }
  const cgCol = cols.find(c => c.startsWith('cg:Z:'))
  if (!cgCol) {
    return
  }
  records.push({
    qName: cols[0]!,
    qLen: +cols[1]!,
    qStart: +cols[2]!,
    qEnd: +cols[3]!,
    strand: cols[4]!,
    tName: cols[5]!,
    tLen: +cols[6]!,
    tStart: +cols[7]!,
    tEnd: +cols[8]!,
    cigar: cgCol.slice(5),
  })
})

rl.on('close', () => {
  // Group records by target refName
  const byRef = new Map<string, PafRecord[]>()
  for (const rec of records) {
    const list = byRef.get(rec.tName)
    if (list) {
      list.push(rec)
    } else {
      byRef.set(rec.tName, [rec])
    }
  }

  const segments: { id: number; len: number }[] = []
  const refPaths = new Map<string, { segId: number; orient: string }[]>()
  const queryPaths = new Map<string, { segId: number; orient: string }[]>()

  let nextSegId = 1

  for (const [refName, recs] of byRef) {
    // Sort by target start
    recs.sort((a, b) => a.tStart - b.tStart)

    const refWalk: { segId: number; orient: string }[] = []
    const queryWalk: { segId: number; orient: string }[] = []

    for (const rec of recs) {
      // Parse CIGAR and create segments
      const ops = rec.cigar.match(/\d+[MIDNSHP=X]/g) ?? []

      for (const op of ops) {
        const len = parseInt(op.slice(0, -1), 10)
        const type = op[op.length - 1]

        if (type === 'M' || type === '=' || type === 'X') {
          // Shared segment — both paths reference it
          const segId = nextSegId++
          segments.push({ id: segId, len })
          refWalk.push({ segId, orient: '+' })
          queryWalk.push({ segId, orient: rec.strand === '+' ? '+' : '-' })
        } else if (type === 'I') {
          // Insertion in query — only query path has this segment
          const segId = nextSegId++
          segments.push({ id: segId, len })
          queryWalk.push({ segId, orient: rec.strand === '+' ? '+' : '-' })
        } else if (type === 'D') {
          // Deletion in query — only ref path has this segment
          const segId = nextSegId++
          segments.push({ id: segId, len })
          refWalk.push({ segId, orient: '+' })
        }
      }
    }

    const refPath = `${refGenome}#0#${refName}`
    const queryPath = `${queryGenome}#0#${refName}`
    refPaths.set(refPath, refWalk)
    queryPaths.set(queryPath, queryWalk)
  }

  // Output GFA
  console.log('H\tVN:Z:1.1')

  for (const seg of segments) {
    console.log(`S\ts${seg.id}\t*\tLN:i:${seg.len}`)
  }

  // Links between consecutive segments in each path
  const links = new Set<string>()
  for (const [, walk] of [...refPaths, ...queryPaths]) {
    for (let i = 0; i < walk.length - 1; i++) {
      const a = walk[i]!
      const b = walk[i + 1]!
      const key = `L\ts${a.segId}\t${a.orient}\ts${b.segId}\t${b.orient}\t0M`
      links.add(key)
    }
  }
  for (const link of links) {
    console.log(link)
  }

  // Walks
  for (const [pathName, walk] of [...refPaths, ...queryPaths]) {
    const [genome, hap, refName] = pathName.split('#')
    const totalLen = walk.reduce((sum, w) => {
      const seg = segments.find(s => s.id === w.segId)!
      return sum + seg.len
    }, 0)
    const walkStr = walk.map(w => `>${w.orient === '+' ? '' : '<'}s${w.segId}`).join('')
    // Use W lines (GFA 1.1 walks)
    const walkFormatted = walk.map(w => `${w.orient === '+' ? '>' : '<'}s${w.segId}`).join('')
    console.log(`W\t${genome}\t${hap}\t${refName}\t0\t${totalLen}\t${walkFormatted}`)
  }
})
