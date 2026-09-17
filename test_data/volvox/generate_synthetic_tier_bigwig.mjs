#!/usr/bin/env node
// Dense 1bp BigWigs for the browser tests of ADR-129's synthetic zoom tiers.
// Seeded, so a rerun writes the same bytes.
//
// wigToBigWig (v2.9) puts the first zoom level of this data at 34bp, so
// BigWigAdapter serves 4bp bins from 2 to 8 bp/px and 16bp bins from 8 to 17.
// Each file holds a signed signal with single-base spikes and dips, which avg
// mode dilutes into its bin and whiskers keeps. Jitter held over 1-4bp runs
// and -blockSize=16 keep each file near 20 KB; the defaults write 110 KB, most
// of it empty index nodes.
//
// Usage: node generate_synthetic_tier_bigwig.mjs   (requires wigToBigWig on PATH)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const START = 1001
const LENGTH = 16000
const NEGATIVE = [9000, 11500]

function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function signal({ seed, period, phase, noise }) {
  const rand = mulberry32(seed)
  const values = []
  let run = 0
  let jitter = 0
  for (let i = 0; i < LENGTH; i++) {
    if (run === 0) {
      run = 1 + Math.floor(rand() * 4)
      jitter = Math.round((rand() * 2 - 1) * noise)
    }
    run--
    const wave =
      Math.round(8 * Math.sin((2 * Math.PI * i) / period + phase)) / 8
    const negative = i >= NEGATIVE[0] && i < NEGATIVE[1]
    let v = negative ? -25 + 8 * wave + jitter : 32 + 16 * wave + jitter
    const r = rand()
    if (r < 0.003) {
      v = negative ? -110 : 120
    } else if (r < 0.006) {
      v = negative ? -1 : 1
    }
    values.push(v)
  }
  return values
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'synthetic-tier-bw-'))
const sizes = path.join(tmp, 'volvox.chrom.sizes')
fs.writeFileSync(
  sizes,
  fs
    .readFileSync(path.join(dir, 'volvox.fa.fai'), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t').slice(0, 2).join('\t'))
    .join('\n') + '\n',
)

const files = [
  { name: 'synthetic_tiers_a.bw', seed: 7, period: 3000, phase: 0, noise: 4 },
  { name: 'synthetic_tiers_b.bw', seed: 11, period: 2200, phase: 1, noise: 6 },
]
for (const { name, ...opts } of files) {
  const wig = path.join(tmp, `${name}.wig`)
  fs.writeFileSync(
    wig,
    `fixedStep chrom=ctgA start=${START} step=1 span=1\n${signal(opts).join('\n')}\n`,
  )
  execFileSync('wigToBigWig', [
    '-blockSize=16',
    wig,
    sizes,
    path.join(dir, name),
  ])
  console.log(`wrote ${name}`)
}
fs.rmSync(tmp, { recursive: true, force: true })
