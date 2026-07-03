#!/usr/bin/env node
// Reproducible volvox self-alignment with introduced variants, used to exercise
// synteny mismatch (cs tag) rendering. Reads volvox.fa, mutates it with a seeded
// RNG (SNPs + a few small indels), writes volvox_snp.fa, then aligns the mutant
// against the original with `minimap2 --cs` to produce volvox_snp.paf.
//
// Usage: node generate_snp_alignment.mjs   (requires minimap2 on PATH)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const SNP_RATE = 0.02 // ~2% substitutions
const INDEL_RATE = 0.0005 // ~1 small indel per 2kb
const SEED = 42

// mulberry32 — small deterministic PRNG so the output is stable across runs
function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function parseFasta(text) {
  const seqs = []
  let cur
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      cur = { name: line.slice(1).trim(), seq: '' }
      seqs.push(cur)
    } else if (cur) {
      cur.seq += line.trim()
    }
  }
  return seqs
}

const BASES = ['A', 'C', 'G', 'T']
function otherBase(b, rand) {
  const up = b.toUpperCase()
  const choices = BASES.filter(x => x !== up)
  return choices[Math.floor(rand() * choices.length)]
}

function mutate(seq, rand) {
  const out = []
  for (let i = 0; i < seq.length; i++) {
    const r = rand()
    if (r < INDEL_RATE) {
      // small indel: half insertions, half deletions (1-3bp)
      const len = 1 + Math.floor(rand() * 3)
      if (rand() < 0.5) {
        out.push(seq[i]) // keep base, then insert
        for (let k = 0; k < len; k++) {
          out.push(BASES[Math.floor(rand() * 4)])
        }
      } else {
        i += len // skip len bases (deletion)
      }
    } else if (r < INDEL_RATE + SNP_RATE) {
      out.push(otherBase(seq[i], rand))
    } else {
      out.push(seq[i])
    }
  }
  return out.join('')
}

function wrap(seq, width = 60) {
  const lines = []
  for (let i = 0; i < seq.length; i += width) {
    lines.push(seq.slice(i, i + width))
  }
  return lines.join('\n')
}

const rand = mulberry32(SEED)
const ref = parseFasta(fs.readFileSync(path.join(dir, 'volvox.fa'), 'utf8'))
const mutated = ref.map(s => ({ name: s.name, seq: mutate(s.seq, rand) }))

const snpFa = mutated.map(s => `>${s.name}\n${wrap(s.seq)}`).join('\n') + '\n'
fs.writeFileSync(path.join(dir, 'volvox_snp.fa'), snpFa)

// minimap2 <target=ref> <query=mutant>; --cs (short form) carries per-base
// diffs compactly. asm5 preset for low intra-species divergence.
const paf = execFileSync(
  'minimap2',
  ['-c', '--cs', '-x', 'asm5', 'volvox.fa', 'volvox_snp.fa'],
  { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 },
)
fs.writeFileSync(path.join(dir, 'volvox_snp.paf'), paf)

const rows = paf.split('\n').filter(Boolean)
console.log(`wrote volvox_snp.fa and volvox_snp.paf (${rows.length} alignment rows)`)
