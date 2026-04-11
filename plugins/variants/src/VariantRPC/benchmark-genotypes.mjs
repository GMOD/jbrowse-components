/**
 * Benchmark for genotype processing hot path in getLDMatrix.
 *
 * Run with: node plugins/variants/src/VariantRPC/benchmark-genotypes.mjs
 *
 * Tests the key functions with realistic data sizes (thousands of variants
 * × thousands of samples).
 */

const SPLITTER = /[/|]/
const SLASH_CODE = 47
const PIPE_CODE = 124
const ZERO_CODE = 48
const DOT_CODE = 46

// ─── Shared helpers ───────────────────────────────────────────────────────────

function encodeGenotypeFromRaw(callGenotype, sampleIdx, ploidy) {
  let nonRef = 0
  let uncalled = 0
  let total = 0
  const offset = sampleIdx * ploidy
  for (let pi = 0; pi < ploidy; pi++) {
    const a = callGenotype[offset + pi]
    if (a === -2) continue
    total++
    if (a === -1) uncalled++
    else if (a !== 0) nonRef++
  }
  if (total === 0 || uncalled === total) return -1
  if (nonRef === 0) return 0
  return nonRef === total - uncalled ? 2 : 1
}

// ─── OLD implementations ─────────────────────────────────────────────────────

function old_encodeGenotypesFromRaw(callGenotype, ploidy, nSamples) {
  const encoded = new Int8Array(nSamples)
  for (let si = 0; si < nSamples; si++) {
    encoded[si] = encodeGenotypeFromRaw(callGenotype, si, ploidy)
  }
  return encoded
}

function old_countEncoded(encoded) {
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0
  for (const g of encoded) {
    if (g === 0) { nHomRef++; nValid++ }
    else if (g === 1) { nHet++; nValid++ }
    else if (g === 2) { nHomAlt++; nValid++ }
  }
  return { nHomRef, nHet, nHomAlt, nValid }
}

function old_encodeGenotypes(genotypes, samples, splitCache) {
  const encoded = new Int8Array(samples.length)
  for (const [i, sample] of samples.entries()) {
    const val = genotypes[sample]
    const alleles = splitCache[val] ?? (splitCache[val] = val.split(SPLITTER))
    let nonRefCount = 0
    let uncalledCount = 0
    for (const allele of alleles) {
      if (allele === '.') uncalledCount++
      else if (allele !== '0') nonRefCount++
    }
    if (uncalledCount === alleles.length) encoded[i] = -1
    else if (nonRefCount === 0) encoded[i] = 0
    else if (nonRefCount === alleles.length) encoded[i] = 2
    else encoded[i] = 1
  }
  return encoded
}

function old_packHaplotypesFromRaw(callGenotype, callGenotypePhased, ploidy, nSamples) {
  const words = Math.ceil(nSamples / 32)
  const altH1 = new Uint32Array(words)
  const validH1 = new Uint32Array(words)
  const altH2 = new Uint32Array(words)
  const validH2 = new Uint32Array(words)
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0
  for (let s = 0; s < nSamples; s++) {
    if (callGenotypePhased && !callGenotypePhased[s]) continue
    const a0 = callGenotype[s * ploidy]
    const a1 = ploidy > 1 ? callGenotype[s * ploidy + 1] : -2
    if (a0 === -2 || a1 === -2) continue
    const w = s >>> 5
    const bit = 1 << (s & 31)
    const v0 = a0 !== -1
    const v1 = a1 !== -1
    if (v0) { validH1[w] |= bit; if (a0 !== 0) altH1[w] |= bit }
    if (v1) { validH2[w] |= bit; if (a1 !== 0) altH2[w] |= bit }
    if (v0 && v1) {
      nValid++
      const isAlt0 = a0 !== 0, isAlt1 = a1 !== 0
      if (!isAlt0 && !isAlt1) nHomRef++
      else if (isAlt0 && isAlt1) nHomAlt++
      else nHet++
    }
  }
  return { altH1, validH1, altH2, validH2, words, nHomRef, nHet, nHomAlt, nValid }
}

function old_packHaplotypesWithCounts(genotypes, samples) {
  const numSamples = samples.length
  const words = Math.ceil(numSamples / 32)
  const altH1 = new Uint32Array(words)
  const validH1 = new Uint32Array(words)
  const altH2 = new Uint32Array(words)
  const validH2 = new Uint32Array(words)
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0
  for (let s = 0; s < numSamples; s++) {
    const val = genotypes[samples[s]]
    const pipe = val.indexOf('|')
    if (pipe === -1) continue
    const a0 = val.slice(0, pipe)
    const a1 = val.slice(pipe + 1)
    const w = s >>> 5, bit = 1 << (s & 31)
    const v0 = a0 !== '.', v1 = a1 !== '.'
    if (v0) { validH1[w] |= bit; if (a0 !== '0') altH1[w] |= bit }
    if (v1) { validH2[w] |= bit; if (a1 !== '0') altH2[w] |= bit }
    if (v0 && v1) {
      nValid++
      const isAlt0 = a0 !== '0', isAlt1 = a1 !== '0'
      if (!isAlt0 && !isAlt1) nHomRef++
      else if (isAlt0 && isAlt1) nHomAlt++
      else nHet++
    }
  }
  return { altH1, validH1, altH2, validH2, words, nHomRef, nHet, nHomAlt, nValid }
}

// ─── NEW implementations ─────────────────────────────────────────────────────

function new_fillEncodedFromRaw(out, callGenotype, ploidy, nSamples) {
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0
  if (ploidy === 2) {
    for (let s = 0; s < nSamples; s++) {
      const off = s << 1
      const a0 = callGenotype[off]
      const a1 = callGenotype[off + 1]
      if (a0 >= 0 && a1 >= 0) {
        const isAlt0 = a0 !== 0, isAlt1 = a1 !== 0
        if (!isAlt0 && !isAlt1) { out[s] = 0; nHomRef++; nValid++ }
        else if (isAlt0 && isAlt1) { out[s] = 2; nHomAlt++; nValid++ }
        else { out[s] = 1; nHet++; nValid++ }
      } else {
        const g = encodeGenotypeFromRaw(callGenotype, s, 2)
        out[s] = g
        if (g === 0) { nHomRef++; nValid++ }
        else if (g === 1) { nHet++; nValid++ }
        else if (g === 2) { nHomAlt++; nValid++ }
      }
    }
  } else {
    for (let s = 0; s < nSamples; s++) {
      const g = encodeGenotypeFromRaw(callGenotype, s, ploidy)
      out[s] = g
      if (g === 0) { nHomRef++; nValid++ }
      else if (g === 1) { nHet++; nValid++ }
      else if (g === 2) { nHomAlt++; nValid++ }
    }
  }
  return { nHomRef, nHet, nHomAlt, nValid }
}

function new_fillEncoded(out, genotypes, samples, splitCache) {
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0
  for (let i = 0; i < samples.length; i++) {
    const val = genotypes[samples[i]]
    const len = val.length
    if (len === 3) {
      const sep = val.charCodeAt(1)
      if (sep === SLASH_CODE || sep === PIPE_CODE) {
        const c0 = val.charCodeAt(0)
        const c1 = val.charCodeAt(2)
        if (c0 === DOT_CODE) {
          if (c1 === DOT_CODE) { out[i] = -1 }
          else if (c1 === ZERO_CODE) { out[i] = 0; nHomRef++; nValid++ }
          else { out[i] = 1; nHet++; nValid++ }
        } else if (c1 === DOT_CODE) {
          if (c0 === ZERO_CODE) { out[i] = 0; nHomRef++; nValid++ }
          else { out[i] = 1; nHet++; nValid++ }
        } else {
          const isAlt0 = c0 !== ZERO_CODE, isAlt1 = c1 !== ZERO_CODE
          if (!isAlt0 && !isAlt1) { out[i] = 0; nHomRef++; nValid++ }
          else if (isAlt0 && isAlt1) { out[i] = 2; nHomAlt++; nValid++ }
          else { out[i] = 1; nHet++; nValid++ }
        }
        continue
      }
    }
    const alleles = splitCache[val] ?? (splitCache[val] = val.split(SPLITTER))
    let nonRefCount = 0, uncalledCount = 0
    for (const allele of alleles) {
      if (allele === '.') uncalledCount++
      else if (allele !== '0') nonRefCount++
    }
    if (uncalledCount === alleles.length) out[i] = -1
    else if (nonRefCount === 0) { out[i] = 0; nHomRef++; nValid++ }
    else if (nonRefCount === alleles.length) { out[i] = 2; nHomAlt++; nValid++ }
    else { out[i] = 1; nHet++; nValid++ }
  }
  return { nHomRef, nHet, nHomAlt, nValid }
}

function new_packHaplotypesFromRaw(callGenotype, callGenotypePhased, ploidy, nSamples) {
  const words = Math.ceil(nSamples / 32)
  const altH1 = new Uint32Array(words)
  const validH1 = new Uint32Array(words)
  const altH2 = new Uint32Array(words)
  const validH2 = new Uint32Array(words)
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0

  if (ploidy === 2) {
    if (callGenotypePhased) {
      for (let s = 0; s < nSamples; s++) {
        if (!callGenotypePhased[s]) continue
        const off = s << 1
        const a0 = callGenotype[off], a1 = callGenotype[off + 1]
        if (a0 === -2 || a1 === -2) continue
        const w = s >>> 5, bit = 1 << (s & 31)
        const v0 = a0 !== -1, v1 = a1 !== -1
        if (v0) { validH1[w] |= bit; if (a0 !== 0) altH1[w] |= bit }
        if (v1) { validH2[w] |= bit; if (a1 !== 0) altH2[w] |= bit }
        if (v0 && v1) {
          nValid++
          const isAlt0 = a0 !== 0, isAlt1 = a1 !== 0
          if (!isAlt0 && !isAlt1) nHomRef++
          else if (isAlt0 && isAlt1) nHomAlt++
          else nHet++
        }
      }
    } else {
      for (let s = 0; s < nSamples; s++) {
        const off = s << 1
        const a0 = callGenotype[off], a1 = callGenotype[off + 1]
        if (a0 === -2 || a1 === -2) continue
        const w = s >>> 5, bit = 1 << (s & 31)
        const v0 = a0 !== -1, v1 = a1 !== -1
        if (v0) { validH1[w] |= bit; if (a0 !== 0) altH1[w] |= bit }
        if (v1) { validH2[w] |= bit; if (a1 !== 0) altH2[w] |= bit }
        if (v0 && v1) {
          nValid++
          const isAlt0 = a0 !== 0, isAlt1 = a1 !== 0
          if (!isAlt0 && !isAlt1) nHomRef++
          else if (isAlt0 && isAlt1) nHomAlt++
          else nHet++
        }
      }
    }
  } else {
    for (let s = 0; s < nSamples; s++) {
      if (callGenotypePhased && !callGenotypePhased[s]) continue
      const a0 = callGenotype[s * ploidy]
      const a1 = ploidy > 1 ? callGenotype[s * ploidy + 1] : -2
      if (a0 === -2 || a1 === -2) continue
      const w = s >>> 5, bit = 1 << (s & 31)
      const v0 = a0 !== -1, v1 = a1 !== -1
      if (v0) { validH1[w] |= bit; if (a0 !== 0) altH1[w] |= bit }
      if (v1) { validH2[w] |= bit; if (a1 !== 0) altH2[w] |= bit }
      if (v0 && v1) {
        nValid++
        const isAlt0 = a0 !== 0, isAlt1 = a1 !== 0
        if (!isAlt0 && !isAlt1) nHomRef++
        else if (isAlt0 && isAlt1) nHomAlt++
        else nHet++
      }
    }
  }
  return { altH1, validH1, altH2, validH2, words, nHomRef, nHet, nHomAlt, nValid }
}

function new_packHaplotypesWithCounts(genotypes, samples) {
  const numSamples = samples.length
  const words = Math.ceil(numSamples / 32)
  const altH1 = new Uint32Array(words)
  const validH1 = new Uint32Array(words)
  const altH2 = new Uint32Array(words)
  const validH2 = new Uint32Array(words)
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0
  for (let s = 0; s < numSamples; s++) {
    const val = genotypes[samples[s]]
    const len = val.length
    if (len === 3 && val.charCodeAt(1) === PIPE_CODE) {
      const c0 = val.charCodeAt(0), c1 = val.charCodeAt(2)
      const w = s >>> 5, bit = 1 << (s & 31)
      const v0 = c0 !== DOT_CODE, v1 = c1 !== DOT_CODE
      if (v0) { validH1[w] |= bit; if (c0 !== ZERO_CODE) altH1[w] |= bit }
      if (v1) { validH2[w] |= bit; if (c1 !== ZERO_CODE) altH2[w] |= bit }
      if (v0 && v1) {
        nValid++
        const isAlt0 = c0 !== ZERO_CODE, isAlt1 = c1 !== ZERO_CODE
        if (!isAlt0 && !isAlt1) nHomRef++
        else if (isAlt0 && isAlt1) nHomAlt++
        else nHet++
      }
      continue
    }
    const pipe = val.indexOf('|')
    if (pipe === -1) continue
    const a0 = val.slice(0, pipe), a1 = val.slice(pipe + 1)
    const w = s >>> 5, bit = 1 << (s & 31)
    const v0 = a0 !== '.', v1 = a1 !== '.'
    if (v0) { validH1[w] |= bit; if (a0 !== '0') altH1[w] |= bit }
    if (v1) { validH2[w] |= bit; if (a1 !== '0') altH2[w] |= bit }
    if (v0 && v1) {
      nValid++
      const isAlt0 = a0 !== '0', isAlt1 = a1 !== '0'
      if (!isAlt0 && !isAlt1) nHomRef++
      else if (isAlt0 && isAlt1) nHomAlt++
      else nHet++
    }
  }
  return { altH1, validH1, altH2, validH2, words, nHomRef, nHet, nHomAlt, nValid }
}

// ─── Data generators ──────────────────────────────────────────────────────────

function makeRawGenotypes(nSamples, ploidy, missingFrac = 0.02) {
  const buf = new Int8Array(nSamples * ploidy)
  const alleles = [0, 0, 0, 0, 1, 1, 1, 2] // mostly ref
  for (let s = 0; s < nSamples; s++) {
    for (let p = 0; p < ploidy; p++) {
      if (Math.random() < missingFrac) {
        buf[s * ploidy + p] = -1
      } else {
        buf[s * ploidy + p] = alleles[Math.floor(Math.random() * alleles.length)]
      }
    }
  }
  return buf
}

function makeStringGenotypes(samples, phased, missingFrac = 0.02) {
  const sep = phased ? '|' : '/'
  const alleles = ['0', '0', '0', '0', '1', '1', '1', '2']
  const genotypes = {}
  for (const s of samples) {
    if (Math.random() < missingFrac) {
      genotypes[s] = './.'
    } else {
      const a0 = alleles[Math.floor(Math.random() * alleles.length)]
      const a1 = alleles[Math.floor(Math.random() * alleles.length)]
      genotypes[s] = `${a0}${sep}${a1}`
    }
  }
  return genotypes
}

function makeSamples(n) {
  return Array.from({ length: n }, (_, i) => `sample${i}`)
}

// ─── Benchmark harness ────────────────────────────────────────────────────────

function bench(label, fn, iterations = 5) {
  // Warmup
  for (let i = 0; i < 3; i++) fn()

  const times = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    fn()
    times.push(performance.now() - t0)
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length
  const min = Math.min(...times)
  const max = Math.max(...times)
  console.log(`  ${label.padEnd(52)} mean=${mean.toFixed(1).padStart(7)}ms  min=${min.toFixed(1).padStart(7)}ms  max=${max.toFixed(1).padStart(7)}ms`)
  return mean
}

function section(title) {
  console.log(`\n${'─'.repeat(80)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(80))
}

// ─── Run benchmarks ───────────────────────────────────────────────────────────

const N_VARIANTS = 2000
const N_SAMPLES = 3000
const PLOIDY = 2

console.log(`\nGenotype processing benchmark`)
console.log(`Variants: ${N_VARIANTS}  Samples: ${N_SAMPLES}  Ploidy: ${PLOIDY}`)
console.log(`Total genotype calls per round: ${(N_VARIANTS * N_SAMPLES).toLocaleString()}`)

// ─── 1. Raw diploid encoding (unphased) ──────────────────────────────────────
section('1. Raw diploid encoding — unphased (Int8Array callGenotype)')

{
  const variants = Array.from({ length: N_VARIANTS }, () =>
    makeRawGenotypes(N_SAMPLES, PLOIDY),
  )

  let oldMean, newMean

  oldMean = bench('OLD: encodeGenotypesFromRaw + separate count loop', () => {
    for (const cg of variants) {
      const enc = old_encodeGenotypesFromRaw(cg, PLOIDY, N_SAMPLES)
      old_countEncoded(enc)
    }
  })

  newMean = bench('NEW: fillEncodedFromRaw into flat buffer (combined pass)', () => {
    const flat = new Int8Array(N_VARIANTS * N_SAMPLES)
    for (let vi = 0; vi < variants.length; vi++) {
      const slot = flat.subarray(vi * N_SAMPLES, (vi + 1) * N_SAMPLES)
      new_fillEncodedFromRaw(slot, variants[vi], PLOIDY, N_SAMPLES)
    }
  })

  console.log(`  → speedup: ${(oldMean / newMean).toFixed(2)}x`)
}

// ─── 2. String encoding — unphased ───────────────────────────────────────────
section('2. String encoding — unphased (genotype strings "X/Y")')

{
  const samples = makeSamples(N_SAMPLES)
  const variants = Array.from({ length: N_VARIANTS }, () =>
    makeStringGenotypes(samples, false),
  )

  let oldMean, newMean

  oldMean = bench('OLD: encodeGenotypes (split() per genotype) + count', () => {
    const splitCache = {}
    for (const gt of variants) {
      const enc = old_encodeGenotypes(gt, samples, splitCache)
      old_countEncoded(enc)
    }
  })

  newMean = bench('NEW: fillEncoded (charCode fast path, flat buffer)', () => {
    const splitCache = {}
    const flat = new Int8Array(N_VARIANTS * N_SAMPLES)
    for (let vi = 0; vi < variants.length; vi++) {
      const slot = flat.subarray(vi * N_SAMPLES, (vi + 1) * N_SAMPLES)
      new_fillEncoded(slot, variants[vi], samples, splitCache)
    }
  })

  console.log(`  → speedup: ${(oldMean / newMean).toFixed(2)}x`)
}

// ─── 3. Phased haplotype packing — raw ───────────────────────────────────────
section('3. Phased haplotype packing — raw (Int8Array, no phase array)')

{
  const variants = Array.from({ length: N_VARIANTS }, () =>
    makeRawGenotypes(N_SAMPLES, PLOIDY),
  )

  let oldMean, newMean

  oldMean = bench('OLD: packHaplotypesFromRaw (ploidy branch in loop)', () => {
    for (const cg of variants) {
      old_packHaplotypesFromRaw(cg, undefined, PLOIDY, N_SAMPLES)
    }
  })

  newMean = bench('NEW: packHaplotypesFromRaw (diploid fast path, single loop)', () => {
    for (const cg of variants) {
      merged_packHaplotypesFromRaw(cg, undefined, PLOIDY, N_SAMPLES)
    }
  })

  console.log(`  → speedup: ${(oldMean / newMean).toFixed(2)}x`)
}

// ─── 4. Phased haplotype packing — raw, with phase array ─────────────────────
section('4. Phased haplotype packing — raw, with callGenotypePhased array')

// Variant: single merged diploid loop (no loop split, but s<<1 offset)
function merged_packHaplotypesFromRaw(callGenotype, callGenotypePhased, ploidy, nSamples) {
  const words = Math.ceil(nSamples / 32)
  const altH1 = new Uint32Array(words)
  const validH1 = new Uint32Array(words)
  const altH2 = new Uint32Array(words)
  const validH2 = new Uint32Array(words)
  let nHomRef = 0, nHet = 0, nHomAlt = 0, nValid = 0
  if (ploidy === 2) {
    for (let s = 0; s < nSamples; s++) {
      if (callGenotypePhased && !callGenotypePhased[s]) continue
      const off = s << 1
      const a0 = callGenotype[off], a1 = callGenotype[off + 1]
      if (a0 === -2 || a1 === -2) continue
      const w = s >>> 5, bit = 1 << (s & 31)
      const v0 = a0 !== -1, v1 = a1 !== -1
      if (v0) { validH1[w] |= bit; if (a0 !== 0) altH1[w] |= bit }
      if (v1) { validH2[w] |= bit; if (a1 !== 0) altH2[w] |= bit }
      if (v0 && v1) {
        nValid++
        const isAlt0 = a0 !== 0, isAlt1 = a1 !== 0
        if (!isAlt0 && !isAlt1) nHomRef++
        else if (isAlt0 && isAlt1) nHomAlt++
        else nHet++
      }
    }
  } else {
    for (let s = 0; s < nSamples; s++) {
      if (callGenotypePhased && !callGenotypePhased[s]) continue
      const a0 = callGenotype[s * ploidy]
      const a1 = ploidy > 1 ? callGenotype[s * ploidy + 1] : -2
      if (a0 === -2 || a1 === -2) continue
      const w = s >>> 5, bit = 1 << (s & 31)
      const v0 = a0 !== -1, v1 = a1 !== -1
      if (v0) { validH1[w] |= bit; if (a0 !== 0) altH1[w] |= bit }
      if (v1) { validH2[w] |= bit; if (a1 !== 0) altH2[w] |= bit }
      if (v0 && v1) {
        nValid++
        const isAlt0 = a0 !== 0, isAlt1 = a1 !== 0
        if (!isAlt0 && !isAlt1) nHomRef++
        else if (isAlt0 && isAlt1) nHomAlt++
        else nHet++
      }
    }
  }
  return { altH1, validH1, altH2, validH2, words, nHomRef, nHet, nHomAlt, nValid }
}

{
  const variants = Array.from({ length: N_VARIANTS }, () =>
    makeRawGenotypes(N_SAMPLES, PLOIDY),
  )
  // Mix of phased/unphased (80% phased)
  const phaseArrays = Array.from({ length: N_VARIANTS }, () => {
    const arr = new Uint8Array(N_SAMPLES)
    for (let i = 0; i < N_SAMPLES; i++) arr[i] = Math.random() < 0.8 ? 1 : 0
    return arr
  })

  let oldMean, splitMean, mergedMean

  oldMean = bench('OLD: packHaplotypesFromRaw (ploidy branch + phase check)', () => {
    for (let vi = 0; vi < variants.length; vi++) {
      old_packHaplotypesFromRaw(variants[vi], phaseArrays[vi], PLOIDY, N_SAMPLES)
    }
  })

  mergedMean = bench('NEW: packHaplotypesFromRaw (single diploid loop, s<<1)', () => {
    for (let vi = 0; vi < variants.length; vi++) {
      merged_packHaplotypesFromRaw(variants[vi], phaseArrays[vi], PLOIDY, N_SAMPLES)
    }
  })

  console.log(`  → speedup: ${(oldMean / mergedMean).toFixed(2)}x`)
}

// ─── 5. Phased haplotype packing — string ────────────────────────────────────
section('5. Phased haplotype packing — string genotypes "X|Y"')

{
  const samples = makeSamples(N_SAMPLES)
  const variants = Array.from({ length: N_VARIANTS }, () =>
    makeStringGenotypes(samples, true),
  )

  let oldMean, newMean

  oldMean = bench('OLD: packHaplotypesWithCounts (indexOf + slice)', () => {
    for (const gt of variants) {
      old_packHaplotypesWithCounts(gt, samples)
    }
  })

  newMean = bench('NEW: packHaplotypesWithCounts (charCode fast path)', () => {
    for (const gt of variants) {
      new_packHaplotypesWithCounts(gt, samples)
    }
  })

  console.log(`  → speedup: ${(oldMean / newMean).toFixed(2)}x`)
}

// ─── 6. Allocation cost: per-variant vs flat buffer ──────────────────────────
section('6. Allocation comparison: per-variant Int8Array vs flat buffer')

{
  const variants = Array.from({ length: N_VARIANTS }, () =>
    makeRawGenotypes(N_SAMPLES, PLOIDY),
  )

  let oldMean, newMean

  oldMean = bench('OLD: new Int8Array(nSamples) per variant', () => {
    for (const cg of variants) {
      const enc = old_encodeGenotypesFromRaw(cg, PLOIDY, N_SAMPLES)
      void enc
    }
  })

  newMean = bench('NEW: subarray view into pre-allocated flat buffer', () => {
    const flat = new Int8Array(N_VARIANTS * N_SAMPLES)
    for (let vi = 0; vi < variants.length; vi++) {
      const slot = flat.subarray(vi * N_SAMPLES, (vi + 1) * N_SAMPLES)
      new_fillEncodedFromRaw(slot, variants[vi], PLOIDY, N_SAMPLES)
    }
  })

  console.log(`  → speedup: ${(oldMean / newMean).toFixed(2)}x`)
}

// ─── 7. Correctness check ─────────────────────────────────────────────────────
section('7. Correctness check (old vs new must agree)')

{
  const samples = makeSamples(500)
  const splitCache = {}
  let errors = 0

  // Raw unphased
  for (let t = 0; t < 20; t++) {
    const cg = makeRawGenotypes(500, 2)
    const flat = new Int8Array(500)
    const newCounts = new_fillEncodedFromRaw(flat, cg, 2, 500)
    const oldEnc = old_encodeGenotypesFromRaw(cg, 2, 500)
    const oldCounts = old_countEncoded(oldEnc)
    for (let i = 0; i < 500; i++) {
      if (flat[i] !== oldEnc[i]) {
        console.error(`  RAW mismatch at sample ${i}: new=${flat[i]} old=${oldEnc[i]}`)
        errors++
      }
    }
    if (newCounts.nHomRef !== oldCounts.nHomRef || newCounts.nHet !== oldCounts.nHet ||
        newCounts.nHomAlt !== oldCounts.nHomAlt || newCounts.nValid !== oldCounts.nValid) {
      console.error(`  RAW count mismatch: new=${JSON.stringify(newCounts)} old=${JSON.stringify(oldCounts)}`)
      errors++
    }
  }

  // String unphased
  for (let t = 0; t < 20; t++) {
    const gt = makeStringGenotypes(samples, false)
    const flat = new Int8Array(500)
    const newCounts = new_fillEncoded(flat, gt, samples, splitCache)
    const oldEnc = old_encodeGenotypes(gt, samples, {})
    const oldCounts = old_countEncoded(oldEnc)
    for (let i = 0; i < 500; i++) {
      if (flat[i] !== oldEnc[i]) {
        const val = gt[samples[i]]
        console.error(`  STRING mismatch at sample ${i} (gt="${val}"): new=${flat[i]} old=${oldEnc[i]}`)
        errors++
      }
    }
    if (newCounts.nHomRef !== oldCounts.nHomRef || newCounts.nHet !== oldCounts.nHet ||
        newCounts.nHomAlt !== oldCounts.nHomAlt || newCounts.nValid !== oldCounts.nValid) {
      console.error(`  STRING count mismatch: new=${JSON.stringify(newCounts)} old=${JSON.stringify(oldCounts)}`)
      errors++
    }
  }

  // Phased raw
  for (let t = 0; t < 20; t++) {
    const cg = makeRawGenotypes(500, 2)
    const ph = new Uint8Array(500).map(() => Math.random() < 0.8 ? 1 : 0)
    const r1 = old_packHaplotypesFromRaw(cg, ph, 2, 500)
    const r2 = new_packHaplotypesFromRaw(cg, ph, 2, 500)
    if (r1.nHomRef !== r2.nHomRef || r1.nHet !== r2.nHet ||
        r1.nHomAlt !== r2.nHomAlt || r1.nValid !== r2.nValid) {
      console.error(`  PACK RAW count mismatch: new=${JSON.stringify({nHomRef:r2.nHomRef,nHet:r2.nHet,nHomAlt:r2.nHomAlt,nValid:r2.nValid})} old=${JSON.stringify({nHomRef:r1.nHomRef,nHet:r1.nHet,nHomAlt:r1.nHomAlt,nValid:r1.nValid})}`)
      errors++
    }
    for (let w = 0; w < r1.words; w++) {
      if (r1.altH1[w] !== r2.altH1[w] || r1.validH1[w] !== r2.validH1[w] ||
          r1.altH2[w] !== r2.altH2[w] || r1.validH2[w] !== r2.validH2[w]) {
        console.error(`  PACK RAW bit mismatch at word ${w}`)
        errors++
        break
      }
    }
  }

  // Phased string
  for (let t = 0; t < 20; t++) {
    const gt = makeStringGenotypes(samples, true)
    const r1 = old_packHaplotypesWithCounts(gt, samples)
    const r2 = new_packHaplotypesWithCounts(gt, samples)
    if (r1.nHomRef !== r2.nHomRef || r1.nHet !== r2.nHet ||
        r1.nHomAlt !== r2.nHomAlt || r1.nValid !== r2.nValid) {
      console.error(`  PACK STR count mismatch`)
      errors++
    }
    for (let w = 0; w < r1.words; w++) {
      if (r1.altH1[w] !== r2.altH1[w] || r1.validH1[w] !== r2.validH1[w] ||
          r1.altH2[w] !== r2.altH2[w] || r1.validH2[w] !== r2.validH2[w]) {
        console.error(`  PACK STR bit mismatch at word ${w}`)
        errors++
        break
      }
    }
  }

  if (errors === 0) {
    console.log('  All correctness checks passed.')
  } else {
    console.error(`  ${errors} correctness error(s) found!`)
    process.exit(1)
  }
}

console.log()
