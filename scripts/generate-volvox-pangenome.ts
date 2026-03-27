#!/usr/bin/env node
// Generates 50 mutated FASTA assemblies from the volvox ctgA reference.
// Used as input to pggb for pangenome graph construction.
//
// Usage:
//   node --experimental-strip-types scripts/generate-volvox-pangenome.ts <output_dir>

import { mkdirSync, writeFileSync, readFileSync } from 'fs'

const SEED = 42
const NUM_SAMPLES = 50
const REF_FASTA = 'test_data/volvox/volvox.fa'
const REF_NAME = 'ctgA'

function createRng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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

const COMP: Record<string, string> = {
  A: 'T', T: 'A', C: 'G', G: 'C',
  a: 't', t: 'a', c: 'g', g: 'c',
}

function reverseComplement(seq: string) {
  let result = ''
  for (let i = seq.length - 1; i >= 0; i--) {
    result += COMP[seq[i]!] ?? seq[i]
  }
  return result
}

interface Variant {
  pos: number
  refAllele: string
  altAllele: string
  freq: number
}

function generateVariantPool(refSeq: string, rng: () => number) {
  const variants: Variant[] = []
  const refLen = refSeq.length
  const refUpper = refSeq.toUpperCase()

  // SNPs
  for (let i = 0; i < 500; i++) {
    const pos = Math.floor(rng() * (refLen - 100)) + 50
    const refBase = refUpper[pos]!
    const bases = 'ACGT'.replace(refBase, '')
    variants.push({
      pos,
      refAllele: refBase,
      altAllele: bases[Math.floor(rng() * 3)]!,
      freq: Math.max(0.02, Math.min(0.98, rng())),
    })
  }

  // Small indels
  for (let i = 0; i < 50; i++) {
    const pos = Math.floor(rng() * (refLen - 200)) + 100
    const indelLen = Math.floor(rng() * 19) + 2
    const freq = Math.max(0.05, Math.min(0.8, rng()))
    if (rng() < 0.5) {
      const ref = refUpper.slice(pos, pos + indelLen)
      variants.push({ pos, refAllele: ref, altAllele: ref[0]!, freq })
    } else {
      const anchor = refUpper[pos]!
      let ins = anchor
      for (let j = 0; j < indelLen; j++) {
        ins += 'ACGT'[Math.floor(rng() * 4)]
      }
      variants.push({ pos, refAllele: anchor, altAllele: ins, freq })
    }
  }

  // Large deletions
  for (let i = 0; i < 5; i++) {
    const pos = Math.floor(rng() * (refLen - 5000)) + 500
    const len = Math.floor(rng() * 2900) + 100
    const ref = refUpper.slice(pos, pos + len)
    variants.push({
      pos, refAllele: ref, altAllele: ref[0]!,
      freq: Math.max(0.05, Math.min(0.5, rng())),
    })
  }

  // Large insertions
  for (let i = 0; i < 3; i++) {
    const pos = Math.floor(rng() * (refLen - 1000)) + 500
    const len = Math.floor(rng() * 1900) + 100
    const anchor = refUpper[pos]!
    let ins = anchor
    for (let j = 0; j < len; j++) {
      ins += 'ACGT'[Math.floor(rng() * 4)]
    }
    variants.push({
      pos, refAllele: anchor, altAllele: ins,
      freq: Math.max(0.05, Math.min(0.3, rng())),
    })
  }

  // Inversions
  for (let i = 0; i < 2; i++) {
    const pos = Math.floor(rng() * (refLen - 6000)) + 1000
    const len = Math.floor(rng() * 4500) + 500
    const ref = refUpper.slice(pos, pos + len)
    variants.push({
      pos, refAllele: ref, altAllele: reverseComplement(ref),
      freq: 0.4 + rng() * 0.2,
    })
  }

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

function applyVariants(refSeq: string, variants: Variant[], carriedIndices: Set<number>) {
  const parts: string[] = []
  let pos = 0
  for (let vi = 0; vi < variants.length; vi++) {
    const v = variants[vi]!
    if (v.pos > pos) {
      parts.push(refSeq.slice(pos, v.pos))
    }
    if (carriedIndices.has(vi)) {
      parts.push(v.altAllele)
    } else {
      parts.push(v.refAllele)
    }
    pos = v.pos + v.refAllele.length
  }
  if (pos < refSeq.length) {
    parts.push(refSeq.slice(pos))
  }
  return parts.join('')
}

function writeFasta(path: string, name: string, seq: string) {
  const lines = [`>${name}`]
  for (let i = 0; i < seq.length; i += 80) {
    lines.push(seq.slice(i, i + 80))
  }
  writeFileSync(path, lines.join('\n') + '\n')
}

// --- Main ---
const outDir = process.argv[2]
if (!outDir) {
  console.error('Usage: node --experimental-strip-types scripts/generate-volvox-pangenome.ts <output_dir>')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

const rng = createRng(SEED)
const seqs = readFasta(REF_FASTA)
const refSeq = seqs.get(REF_NAME)
if (!refSeq) {
  console.error(`Reference sequence ${REF_NAME} not found in ${REF_FASTA}`)
  process.exit(1)
}
const refUpper = refSeq.toUpperCase()

console.error(`Reference: ${REF_NAME} (${refSeq.length}bp)`)

const variants = generateVariantPool(refSeq, rng)
console.error(`Variant pool: ${variants.length} sites`)

// Write reference FASTA with PanSN-compatible name
writeFasta(`${outDir}/ref#0#${REF_NAME}.fa`, `ref#0#${REF_NAME}`, refUpper)

// Generate and write sample FASTAs
for (let si = 0; si < NUM_SAMPLES; si++) {
  const carried = new Set<number>()
  for (let vi = 0; vi < variants.length; vi++) {
    if (rng() < variants[vi]!.freq) {
      carried.add(vi)
    }
  }
  const sampleName = `sample${String(si + 1).padStart(2, '0')}#0`
  const sampleSeq = applyVariants(refUpper, variants, carried)
  writeFasta(`${outDir}/${sampleName}#${REF_NAME}.fa`, `${sampleName}#${REF_NAME}`, sampleSeq)
}

console.error(`Wrote ${NUM_SAMPLES + 1} FASTA files to ${outDir}`)
