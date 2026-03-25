#!/usr/bin/env node
// Standalone VCF-to-bubbles converter.
// Reads a VCF from `vg deconstruct` and outputs bubbles BED to stdout.
// Usage: node --experimental-strip-types scripts/vcf-to-bubbles.ts input.vcf.gz

import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { createGunzip } from 'zlib'

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

// Skip allele pairs where both sequences exceed this length — computing CS
// for huge SVs is too slow and won't render meaningful base-level detail.
const MAX_ALLELE_LEN = 10_000
// Cap the number of pairwise comparisons per VCF site to avoid O(n²) blowup
// on highly multi-allelic SVs.
const MAX_PAIRS_PER_SITE = 500

const vcfPath = process.argv[2]
if (!vcfPath) {
  console.error('Usage: node --experimental-strip-types scripts/vcf-to-bubbles.ts <input.vcf.gz>')
  process.exit(1)
}

const raw = createReadStream(vcfPath)
const decompressed = vcfPath.endsWith('.gz') ? raw.pipe(createGunzip()) : raw

const rl = createInterface({ input: decompressed })
let recordCount = 0

rl.on('line', (line: string) => {
  if (line.startsWith('##')) {
    return
  }
  if (line.startsWith('#CHROM')) {
    const fields = line.split('\t')
    if (fields.length > 9) {
      const sampleNames = fields.slice(9)
      process.stdout.write(`#genomes=${sampleNames.join(',')}\n`)
    }
    return
  }

  const fields = line.split('\t')
  if (fields.length < 10) {
    return
  }

  const chrom = fields[0]!
  const pos = parseInt(fields[1]!, 10)
  const refSeq = fields[3]!.toLowerCase()
  const altField = fields[4]!
  const start = pos - 1
  const end = start + refSeq.length

  const alleles = [refSeq]
  for (const alt of altField.split(',')) {
    alleles.push(alt.toLowerCase())
  }

  const numAlleles = alleles.length
  const alleleGenomes: number[][] = Array.from({ length: numAlleles }, () => [])

  for (let si = 0; si < fields.length - 9; si++) {
    const sampleField = fields[9 + si]!
    const gt = sampleField.split(':')[0]!
    for (const part of gt.split(/[|/]/)) {
      if (part !== '.') {
        const idx = parseInt(part, 10)
        if (idx >= 0 && idx < numAlleles) {
          alleleGenomes[idx]!.push(si)
        }
      }
    }
  }

  let sitePairs = 0
  for (let a = 0; a < numAlleles; a++) {
    for (let b = a + 1; b < numAlleles; b++) {
      if (sitePairs >= MAX_PAIRS_PER_SITE) {
        break
      }
      const seqA = alleles[a]!
      const seqB = alleles[b]!
      // For very large alleles, skip detailed CS — just record the site
      let cs: string
      let identity: number
      if (seqA.length > MAX_ALLELE_LEN && seqB.length > MAX_ALLELE_LEN) {
        cs = ''
        identity = 0
      } else {
        cs = computeTextCs(seqA, seqB)
        identity = computeIdentity(seqA, seqB)
      }
      const genomesA = alleleGenomes[a]!.join(',')
      const genomesB = alleleGenomes[b]!.join(',')
      process.stdout.write(
        `${chrom}\t${start}\t${end}\t${a}\t${b}\t${identity.toFixed(6)}\t${cs}\t${genomesA}\t${genomesB}\n`,
      )
      recordCount++
      sitePairs++
    }
    if (sitePairs >= MAX_PAIRS_PER_SITE) {
      break
    }
  }
})

rl.on('close', () => {
  console.error(`vcf-to-bubbles: ${recordCount} records written`)
})
