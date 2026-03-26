#!/usr/bin/env node
/* eslint-env node */
// Generates synthetic PAF test data for multi-genome synteny testing.
// Usage: node generate-synthetic-data.mjs [output-dir]

import fs from 'fs'
import path from 'path'

const outDir =
  process.argv[2] || path.join(import.meta.dirname, '..', 'synthetic')
fs.mkdirSync(outDir, { recursive: true })

function generateChromosomes(assemblyName, numChrs, baseLengths) {
  return baseLengths.slice(0, numChrs).map((len, i) => ({
    name: `${assemblyName}.chr${i + 1}`,
    length: len + Math.floor(Math.random() * len * 0.02),
  }))
}

function generatePairwisePAF(queryChrs, targetChrs, divergence) {
  const lines = []
  for (let c = 0; c < Math.min(queryChrs.length, targetChrs.length); c++) {
    const q = queryChrs[c]
    const t = targetChrs[c]
    const blockSize = 100000
    const minLen = Math.min(q.length, t.length)

    for (let pos = 0; pos < minLen - blockSize; pos += blockSize) {
      const rand = Math.random()

      // 90% syntenic, 5% inverted, 3% small offset (rearrangement), 2% gap
      if (rand < 0.02) {
        continue // gap
      }

      const isInversion = rand > 0.95
      const hasOffset = rand > 0.9 && rand <= 0.95
      const offset = hasOffset
        ? Math.floor(Math.random() * blockSize * 3)
        : Math.floor(Math.random() * 500)

      const qstart = pos
      const qend = pos + blockSize
      const tstart = Math.max(0, pos + offset)
      const tend = tstart + blockSize
      const strand = isInversion ? '-' : '+'
      const identity = 0.95 + Math.random() * divergence
      const matches = Math.floor(blockSize * identity)

      // Generate a simple CIGAR
      const cigarOps = []
      let remaining = blockSize
      while (remaining > 0) {
        const opLen = Math.min(
          remaining,
          Math.floor(500 + Math.random() * 5000),
        )
        cigarOps.push(`${opLen}M`)
        remaining -= opLen
        if (remaining > 100 && Math.random() < 0.1) {
          const indelLen = Math.floor(10 + Math.random() * 200)
          const op = Math.random() < 0.5 ? 'I' : 'D'
          cigarOps.push(`${indelLen}${op}`)
          if (op === 'D') {
            remaining -= indelLen
          }
        }
      }

      lines.push(
        [
          q.name,
          q.length,
          qstart,
          qend,
          strand,
          t.name,
          t.length,
          tstart,
          tend,
          matches,
          blockSize,
          60,
          `cg:Z:${cigarOps.join('')}`,
        ].join('\t'),
      )
    }
  }
  return lines
}

// 3-genome dataset (small, for quick tests)
console.warn('Generating 3-genome synthetic dataset...')
const baseLens3 = [30_000_000, 20_000_000, 15_000_000]
const asm3_A = generateChromosomes('genomeA', 3, baseLens3)
const asm3_B = generateChromosomes('genomeB', 3, baseLens3)
const asm3_C = generateChromosomes('genomeC', 3, baseLens3)

const paf3_AB = generatePairwisePAF(asm3_A, asm3_B, 0.04)
const paf3_BC = generatePairwisePAF(asm3_B, asm3_C, 0.04)
fs.writeFileSync(
  path.join(outDir, 'synthetic_3way.paf'),
  [...paf3_AB, ...paf3_BC].join('\n'),
)

// 8-genome dataset (larger, for scalability testing)
console.warn('Generating 8-genome synthetic dataset...')
const baseLens8 = [50_000_000, 40_000_000, 35_000_000, 30_000_000, 25_000_000]
const names8 = [
  'species1',
  'species2',
  'species3',
  'species4',
  'species5',
  'species6',
  'species7',
  'species8',
]
const assemblies8 = names8.map(n => generateChromosomes(n, 5, baseLens8))

const paf8Lines = []
for (let i = 0; i < assemblies8.length - 1; i++) {
  const divergence = 0.04 - i * 0.003
  const pairLines = generatePairwisePAF(
    assemblies8[i],
    assemblies8[i + 1],
    divergence,
  )
  for (const line of pairLines) {
    paf8Lines.push(line)
  }
}
fs.writeFileSync(path.join(outDir, 'synthetic_8way.paf'), paf8Lines.join('\n'))

// All-vs-all PAF (5 genomes, all pairs)
console.warn('Generating all-vs-all synthetic dataset...')
const baseLensAll = [20_000_000, 15_000_000]
const namesAll = ['alpha', 'beta', 'gamma', 'delta', 'epsilon']
const assembliesAll = namesAll.map(n => generateChromosomes(n, 2, baseLensAll))

const pafAllLines = []
for (let i = 0; i < assembliesAll.length; i++) {
  for (let j = i + 1; j < assembliesAll.length; j++) {
    const pairLines = generatePairwisePAF(
      assembliesAll[i],
      assembliesAll[j],
      0.04,
    )
    for (const line of pairLines) {
      pafAllLines.push(line)
    }
  }
}
fs.writeFileSync(
  path.join(outDir, 'synthetic_allvsall.paf'),
  pafAllLines.join('\n'),
)

// Small GFA with P-lines (4 genomes, 1 chromosome)
console.warn('Generating synthetic GFA...')
const segmentCount = 200
const segLengths = Array.from({ length: segmentCount }, () =>
  Math.floor(1000 + Math.random() * 50000),
)

const gfaLines = ['H\tVN:Z:1.0']

// Reference segments
for (let i = 0; i < segmentCount; i++) {
  const seq = 'N'.repeat(Math.min(segLengths[i], 100))
  gfaLines.push(`S\ts${i}\t${seq}\tLN:i:${segLengths[i]}`)
}

// Variant segments (10% of positions)
let varIdx = segmentCount
const variantSegments = []
for (let i = 0; i < segmentCount; i++) {
  if (Math.random() < 0.1) {
    const varLen = Math.floor(segLengths[i] * (0.8 + Math.random() * 0.4))
    gfaLines.push(`S\ts${varIdx}\tN\tLN:i:${varLen}`)
    variantSegments.push({ refIdx: i, varIdx, varLen })
    varIdx++
  }
}

// Links
for (let i = 0; i < segmentCount - 1; i++) {
  gfaLines.push(`L\ts${i}\t+\ts${i + 1}\t+\t0M`)
}
for (const v of variantSegments) {
  if (v.refIdx > 0) {
    gfaLines.push(`L\ts${v.refIdx - 1}\t+\ts${v.varIdx}\t+\t0M`)
  }
  if (v.refIdx < segmentCount - 1) {
    gfaLines.push(`L\ts${v.varIdx}\t+\ts${v.refIdx + 1}\t+\t0M`)
  }
}

// Paths for 4 genomes
const genomeNames = [
  'ref#1#chr1',
  'sample1#1#chr1',
  'sample2#1#chr1',
  'sample3#1#chr1',
]
for (let g = 0; g < genomeNames.length; g++) {
  const steps = []
  for (let i = 0; i < segmentCount; i++) {
    const variant = variantSegments.find(v => v.refIdx === i)
    if (variant && g > 0 && Math.random() < 0.3) {
      steps.push(`s${variant.varIdx}+`)
    } else {
      steps.push(`s${i}+`)
    }
  }
  gfaLines.push(`P\t${genomeNames[g]}\t${steps.join(',')}\t*`)
}

fs.writeFileSync(
  path.join(outDir, 'synthetic_4genome.gfa'),
  gfaLines.join('\n'),
)

// Generate FAI-like chromosome length files for assemblies
for (const name of ['genomeA', 'genomeB', 'genomeC']) {
  const chrs =
    name === 'genomeA' ? asm3_A : name === 'genomeB' ? asm3_B : asm3_C
  const fai = chrs.map(c => `${c.name}\t${c.length}`).join('\n')
  fs.writeFileSync(path.join(outDir, `${name}.chrom.sizes`), fai)
}

console.warn(`Generated files in ${outDir}:`)
for (const f of fs.readdirSync(outDir)) {
  const stat = fs.statSync(path.join(outDir, f))
  console.warn(`  ${f}: ${(stat.size / 1024).toFixed(1)} KB`)
}
