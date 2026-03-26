#!/usr/bin/env node
// Generates a synthetic 50-sample pangenome on the volvox ctgA reference.
// Outputs a segment-decomposed GFA and a bubbles BED file.
//
// Usage:
//   node --experimental-strip-types scripts/generate-volvox-pangenome.ts \
//     test_data/volvox/volvox_pangenome_50.gfa \
//     test_data/volvox/volvox_pangenome_50.bubbles.bed

import { readFileSync, writeFileSync } from 'fs'

const SEED = 42
const NUM_SAMPLES = 50
const REF_FASTA = 'test_data/volvox/volvox.fa'
const REF_NAME = 'ctgA'

// --- Seeded RNG (mulberry32) ---
function createRng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- FASTA reader ---
function readFasta(path: string) {
  const lines = readFileSync(path, 'utf8').split('\n')
  const seqs = new Map<string, string>()
  let name = ''
  let seq = ''
  for (const line of lines) {
    if (line.startsWith('>')) {
      if (name) {
        seqs.set(name, seq)
      }
      name = line.slice(1).split(/\s/)[0]!
      seq = ''
    } else {
      seq += line.trim()
    }
  }
  if (name) {
    seqs.set(name, seq)
  }
  return seqs
}

// --- Reverse complement ---
const COMP: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  a: 't',
  t: 'a',
  c: 'g',
  g: 'c',
}

function reverseComplement(seq: string) {
  let result = ''
  for (let i = seq.length - 1; i >= 0; i--) {
    result += COMP[seq[i]!] ?? seq[i]
  }
  return result
}

// --- CS/identity computation ---
function computeTextCs(refSeq: string, querySeq: string) {
  const minLen = Math.min(refSeq.length, querySeq.length)
  const parts: string[] = []
  let matchRun = 0
  for (let i = 0; i < minLen; i++) {
    if (refSeq[i] === querySeq[i]) {
      matchRun++
    } else {
      if (matchRun > 0) {
        parts.push(`:${matchRun}`)
        matchRun = 0
      }
      parts.push(`*${refSeq[i]}${querySeq[i]}`)
    }
  }
  if (matchRun > 0) {
    parts.push(`:${matchRun}`)
  }
  if (refSeq.length > minLen) {
    parts.push(`-${refSeq.slice(minLen)}`)
  } else if (querySeq.length > minLen) {
    parts.push(`+${querySeq.slice(minLen)}`)
  }
  return parts.join('')
}

function computeIdentity(refSeq: string, querySeq: string) {
  const minLen = Math.min(refSeq.length, querySeq.length)
  let matches = 0
  for (let i = 0; i < minLen; i++) {
    if (refSeq[i] === querySeq[i]) {
      matches++
    }
  }
  const total = Math.max(refSeq.length, querySeq.length)
  return total > 0 ? matches / total : 0
}

// --- Variant types ---
interface Variant {
  pos: number
  refAllele: string
  altAllele: string
  freq: number
  type: 'snp' | 'indel' | 'sv'
}

// --- Generate variant pool ---
function generateVariantPool(refSeq: string, rng: () => number) {
  const variants: Variant[] = []
  const refLen = refSeq.length
  const refUpper = refSeq.toUpperCase()

  // SNPs: ~500 sites
  for (let i = 0; i < 500; i++) {
    const pos = Math.floor(rng() * (refLen - 100)) + 50
    const refBase = refUpper[pos]!
    const bases = 'ACGT'.replace(refBase, '')
    const altBase = bases[Math.floor(rng() * 3)]!
    const freq = Math.max(0.02, Math.min(0.98, rng()))
    variants.push({
      pos,
      refAllele: refBase.toLowerCase(),
      altAllele: altBase.toLowerCase(),
      freq,
      type: 'snp',
    })
  }

  // Small indels: ~50 sites
  for (let i = 0; i < 50; i++) {
    const pos = Math.floor(rng() * (refLen - 200)) + 100
    const indelLen = Math.floor(rng() * 19) + 2
    const freq = Math.max(0.05, Math.min(0.8, rng()))
    if (rng() < 0.5) {
      // Deletion: ref has anchor + deleted bases, alt is anchor only
      const ref = refSeq.slice(pos, pos + indelLen).toLowerCase()
      variants.push({
        pos,
        refAllele: ref,
        altAllele: ref[0]!,
        freq,
        type: 'indel',
      })
    } else {
      // Insertion: ref is anchor, alt is anchor + inserted bases
      const anchor = refSeq[pos]!.toLowerCase()
      let insertSeq = anchor
      for (let j = 0; j < indelLen; j++) {
        insertSeq += 'acgt'[Math.floor(rng() * 4)]
      }
      variants.push({
        pos,
        refAllele: anchor,
        altAllele: insertSeq,
        freq,
        type: 'indel',
      })
    }
  }

  // Large deletions: ~5
  for (let i = 0; i < 5; i++) {
    const pos = Math.floor(rng() * (refLen - 5000)) + 500
    const len = Math.floor(rng() * 2900) + 100
    const freq = Math.max(0.05, Math.min(0.5, rng()))
    const ref = refSeq.slice(pos, pos + len).toLowerCase()
    variants.push({
      pos,
      refAllele: ref,
      altAllele: ref[0]!,
      freq,
      type: 'sv',
    })
  }

  // Large insertions: ~3
  for (let i = 0; i < 3; i++) {
    const pos = Math.floor(rng() * (refLen - 1000)) + 500
    const len = Math.floor(rng() * 1900) + 100
    const freq = Math.max(0.05, Math.min(0.3, rng()))
    const anchor = refSeq[pos]!.toLowerCase()
    let insertSeq = anchor
    for (let j = 0; j < len; j++) {
      insertSeq += 'acgt'[Math.floor(rng() * 4)]
    }
    variants.push({
      pos,
      refAllele: anchor,
      altAllele: insertSeq,
      freq,
      type: 'sv',
    })
  }

  // Inversions: ~2 shared across ~half
  for (let i = 0; i < 2; i++) {
    const pos = Math.floor(rng() * (refLen - 6000)) + 1000
    const len = Math.floor(rng() * 4500) + 500
    const ref = refSeq.slice(pos, pos + len).toLowerCase()
    const alt = reverseComplement(ref)
    variants.push({
      pos,
      refAllele: ref,
      altAllele: alt,
      freq: 0.4 + rng() * 0.2,
      type: 'sv',
    })
  }

  // Sort by position and remove overlaps
  variants.sort((a, b) => a.pos - b.pos)
  const filtered: Variant[] = []
  let lastEnd = 0
  for (const v of variants) {
    if (v.pos >= lastEnd) {
      filtered.push(v)
      lastEnd = v.pos + v.refAllele.length
    }
  }
  return filtered
}

// --- Assign variants to samples ---
function assignVariants(
  variants: Variant[],
  numSamples: number,
  rng: () => number,
) {
  const assignments = new Map<number, Set<number>>()
  for (let vi = 0; vi < variants.length; vi++) {
    const carriers = new Set<number>()
    for (let si = 0; si < numSamples; si++) {
      if (rng() < variants[vi]!.freq) {
        carriers.add(si)
      }
    }
    assignments.set(vi, carriers)
  }
  return assignments
}

// --- Graph piece types ---
interface InterstitialPiece {
  type: 'interstitial'
  segId: number
}

interface VariantPiece {
  type: 'variant'
  refSegId: number
  altSegId: number
  variantIdx: number
}

type GraphPiece = InterstitialPiece | VariantPiece

// --- Build GFA ---
function buildGfa(
  refSeq: string,
  variants: Variant[],
  assignments: Map<number, Set<number>>,
  numSamples: number,
) {
  const lines: string[] = ['H\tVN:Z:1.1']
  const segLens = new Map<number, number>()
  let nextId = 1

  function addSegment(len: number) {
    const id = nextId++
    segLens.set(id, len)
    lines.push(`S\ts${id}\t*\tLN:i:${len}`)
    return id
  }

  // Build graph pieces
  const pieces: GraphPiece[] = []
  let pos = 0
  for (let vi = 0; vi < variants.length; vi++) {
    const v = variants[vi]!
    if (v.pos > pos) {
      pieces.push({ type: 'interstitial', segId: addSegment(v.pos - pos) })
    }
    pieces.push({
      type: 'variant',
      refSegId: addSegment(v.refAllele.length),
      altSegId: addSegment(v.altAllele.length),
      variantIdx: vi,
    })
    pos = v.pos + v.refAllele.length
  }
  if (pos < refSeq.length) {
    pieces.push({
      type: 'interstitial',
      segId: addSegment(refSeq.length - pos),
    })
  }

  // Build walks
  const genomeNames: string[] = ['ref#0']
  for (let si = 0; si < numSamples; si++) {
    genomeNames.push(`sample${String(si + 1).padStart(2, '0')}#0`)
  }

  function buildWalk(sampleIdx: number | null) {
    const walk: number[] = []
    for (const piece of pieces) {
      if (piece.type === 'interstitial') {
        walk.push(piece.segId)
      } else {
        if (sampleIdx === null) {
          walk.push(piece.refSegId)
        } else {
          const hasAlt = assignments.get(piece.variantIdx)!.has(sampleIdx)
          walk.push(hasAlt ? piece.altSegId : piece.refSegId)
        }
      }
    }
    return walk
  }

  const allWalks: { genome: string; walk: number[] }[] = [
    { genome: genomeNames[0]!, walk: buildWalk(null) },
  ]
  for (let si = 0; si < numSamples; si++) {
    allWalks.push({ genome: genomeNames[si + 1]!, walk: buildWalk(si) })
  }

  // Links (deduplicated)
  const links = new Set<string>()
  for (const { walk } of allWalks) {
    for (let i = 0; i < walk.length - 1; i++) {
      links.add(`L\ts${walk[i]}\t+\ts${walk[i + 1]}\t+\t0M`)
    }
  }
  for (const link of links) {
    lines.push(link)
  }

  // W lines
  for (const { genome, walk } of allWalks) {
    let totalLen = 0
    for (const segId of walk) {
      totalLen += segLens.get(segId)!
    }
    const walkStr = walk.map(id => `>s${id}`).join('')
    const [gname, hap] = genome.split('#')
    lines.push(`W\t${gname}\t${hap}\t${REF_NAME}\t0\t${totalLen}\t${walkStr}`)
  }

  return { gfa: `${lines.join('\n')}\n`, genomeNames }
}

// --- Build bubbles BED ---
function buildBubbles(
  variants: Variant[],
  assignments: Map<number, Set<number>>,
  genomeNames: string[],
) {
  const lines: string[] = [`#genomes=${genomeNames.join(',')}`]

  for (let vi = 0; vi < variants.length; vi++) {
    const v = variants[vi]!
    const carriers = assignments.get(vi)!
    if (carriers.size === 0) {
      continue
    }

    const refGenomes: number[] = [0] // reference is always index 0
    const altGenomes: number[] = []

    for (let si = 0; si < genomeNames.length - 1; si++) {
      if (carriers.has(si)) {
        altGenomes.push(si + 1) // +1 because ref is index 0
      } else {
        refGenomes.push(si + 1)
      }
    }

    const cs = computeTextCs(v.refAllele, v.altAllele)
    const identity = computeIdentity(v.refAllele, v.altAllele)
    const start = v.pos
    const end = v.pos + v.refAllele.length

    lines.push(
      `${REF_NAME}\t${start}\t${end}\t0\t1\t${identity.toFixed(6)}\t${cs}\t${refGenomes.join(',')}\t${altGenomes.join(',')}`,
    )
  }
  return `${lines.join('\n')}\n`
}

// --- Main ---
const gfaOutput = process.argv[2]
const bubblesOutput = process.argv[3]

if (!gfaOutput || !bubblesOutput) {
  console.error(
    'Usage: node --experimental-strip-types scripts/generate-volvox-pangenome.ts <gfa_output> <bubbles_output>',
  )
  process.exit(1)
}

const rng = createRng(SEED)
const seqs = readFasta(REF_FASTA)
const refSeq = seqs.get(REF_NAME)
if (!refSeq) {
  console.error(`Reference sequence ${REF_NAME} not found in ${REF_FASTA}`)
  process.exit(1)
}

console.error(`Reference: ${REF_NAME} (${refSeq.length}bp)`)

const variants = generateVariantPool(refSeq, rng)
const snps = variants.filter(v => v.type === 'snp').length
const indels = variants.filter(v => v.type === 'indel').length
const svs = variants.filter(v => v.type === 'sv').length
console.error(
  `Variant pool: ${variants.length} sites (${snps} SNPs, ${indels} indels, ${svs} SVs)`,
)

const assignments = assignVariants(variants, NUM_SAMPLES, rng)

const { gfa, genomeNames } = buildGfa(
  refSeq,
  variants,
  assignments,
  NUM_SAMPLES,
)
writeFileSync(gfaOutput, gfa)
console.error(`GFA written to ${gfaOutput}`)

const bubbles = buildBubbles(variants, assignments, genomeNames)
writeFileSync(bubblesOutput, bubbles)
console.error(`Bubbles BED written to ${bubblesOutput}`)

// Summary stats
let totalCarriers = 0
for (const [, carriers] of assignments) {
  totalCarriers += carriers.size
}
console.error(
  `Average variants per sample: ${(totalCarriers / NUM_SAMPLES).toFixed(1)}`,
)
