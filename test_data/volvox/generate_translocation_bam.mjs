#!/usr/bin/env node
// Builds volvox-translocation.bam: a purpose-built ctgA<->ctgB event, for the
// interchromosomal and cross-region read-connection arcs.
//
// Purpose-built rather than carved out of an existing volvox BAM, which is this
// directory's habit (volvox-simple-inv-paired.bam, MM-orient-volvox.bam, ...).
// The one existing candidate does not work: wgsim_short_reads.bam has 131
// interchromosomal records, but every one has its ctgA end inside ~170 bp near
// 9.7 kb with its ctgB mate scattered across the whole 6 kb contig -- a repeat
// signature, which draws as a fan to everywhere and makes a brittle test.
//
// Every coordinate here is FIXED so a test can assert exact counts. What the
// four groups are for is in test_data/volvox/README.md, beside the recipe.
//
// Usage: node generate_translocation_bam.mjs   (requires samtools on PATH)
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const OUT = 'volvox-translocation.bam'
const MAPQ = 60

// Real reference bases, so the pileup under the arcs is clean and the arcs are
// what the eye lands on. Read straight out of volvox.fa rather than through
// `samtools faidx` per read: same bases, one fewer subprocess per record, and
// the same thing generate_snp_alignment.mjs does.
function parseFasta(text) {
  const seqs = {}
  let cur
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      cur = line.slice(1).trim().split(/\s+/)[0]
      seqs[cur] = ''
    } else if (cur) {
      seqs[cur] += line.trim()
    }
  }
  return seqs
}

const ref = parseFasta(fs.readFileSync(path.join(dir, 'volvox.fa'), 'utf8'))
// The @SQ lengths must match volvox.fa exactly or every consumer disagrees with
// the assembly about where the end of a contig is.
const LENGTHS = { ctgA: 50001, ctgB: 6079 }
for (const [name, len] of Object.entries(LENGTHS)) {
  if (ref[name]?.length !== len) {
    throw new Error(
      `${name}: volvox.fa has ${ref[name]?.length}, expected ${len}`,
    )
  }
}

// SEQ is always in REFERENCE orientation in SAM, reverse-strand records
// included, so a matching read is just the reference substring. `start` is
// 0-based; SAM POS is start + 1.
function refSlice(refName, start, length) {
  return ref[refName].slice(start, start + length).toUpperCase()
}

const records = []
function push(fields) {
  records.push(fields.join('\t'))
}

// A plain 100M record. `start` is 0-based.
function aligned({ name, flag, refName, start, mateRef, mateStart, tlen }) {
  const len = 100
  push([
    name,
    flag,
    refName,
    start + 1,
    MAPQ,
    `${len}M`,
    mateRef,
    mateStart + 1,
    tlen,
    refSlice(refName, start, len),
    'I'.repeat(len),
  ])
}

// ---------------------------------------------------------------------------
// 1. A SPLIT-READ JUNCTION at ctgA:20,000 <-> ctgB:3,000, six molecules, all at
//    IDENTICAL coordinates.
//
// Identical on purpose: `arcKey` coalesces on exact coordinates and refuses to
// invent a merged position, so this is the shape that draws as ONE visibly
// thick arc carrying support 6 rather than as six hairlines. That is not a
// contrivance -- a split read knows its breakpoint to the base, and on real
// Iso-Seq data a fusion junction's 29 reads resolve 26/1/1/1 under the same
// rule. Do NOT be tempted to spread these and add a clustering tolerance to
// `arcKey`; that idea has been measured and declined.
//
// Each molecule is a primary 50M50S on ctgA plus a supplementary 50S50M on
// ctgB, with reciprocal SA tags. `unpairedReadChain` sorts them by
// clip-at-start-of-read (0, then 50), so the junction runs ctgA's read-trailing
// edge (20,000) to ctgB's read-leading edge (3,000).
// ---------------------------------------------------------------------------
const SPLIT_A_END = 20_000 // 0-based, exclusive: the ctgA breakpoint
const SPLIT_B_START = 3000 // 0-based: the ctgB breakpoint
const SPLIT_MOLECULES = 6
for (let i = 0; i < SPLIT_MOLECULES; i++) {
  const seq =
    refSlice('ctgA', SPLIT_A_END - 50, 50) + refSlice('ctgB', SPLIT_B_START, 50)
  const qual = 'I'.repeat(100)
  const aPos = SPLIT_A_END - 50 + 1
  const bPos = SPLIT_B_START + 1
  push([
    `split${i}`,
    0,
    'ctgA',
    aPos,
    MAPQ,
    '50M50S',
    '*',
    0,
    0,
    seq,
    qual,
    `SA:Z:ctgB,${bPos},+,50S50M,${MAPQ},0;`,
  ])
  push([
    `split${i}`,
    2048, // supplementary, which the default filter (flagExclude 1540) keeps
    'ctgB',
    bPos,
    MAPQ,
    '50S50M',
    '*',
    0,
    0,
    seq,
    qual,
    `SA:Z:ctgA,${aPos},+,50M50S,${MAPQ},0;`,
  ])
}

// ---------------------------------------------------------------------------
// 2. A MATE-PAIR TRANSLOCATION over the same breakpoint, eight pairs, every
//    coordinate distinct.
//
// The honest mate-pair signature, and the counterpart to group 1: mates
// STRADDLE a breakpoint rather than landing on it, so no two agree on a
// coordinate and `arcKey`'s exact count is 1 for each. It draws as a fan of
// eight arcs, which is what a translocation looks like on paired-end data, and
// it is why the support floor counts over a window (`clusteredInterchromSupport`)
// instead of at a coordinate -- both sides cluster within 200 bp, so the fan
// survives the default `minInterchromSupport: 2` that an exact count would wipe.
//
// ctgA read forward, ctgB read reverse, so the outer (5', read-leading) edges
// `mateLinkArc` uses are the ctgA start and the ctgB end.
// ---------------------------------------------------------------------------
const MATE_PAIRS = 8
const MATE_STEP = 25
for (let i = 0; i < MATE_PAIRS; i++) {
  const aStart = 19_800 + i * MATE_STEP // arc foot: 19,800 .. 19,975
  const bStart = 2800 + i * MATE_STEP // arc foot is bStart + 100: 2,900 .. 3,075
  // TLEN 0 on both, which is what SAM sets across references -- and what the
  // read cloud's fallback to the endpoint gap would otherwise turn into a
  // 100 Mb "insert size" on the ruler, hence arcs in arc mode only.
  aligned({
    name: `mate${i}`,
    flag: 97, // paired, first in pair, mate reverse
    refName: 'ctgA',
    start: aStart,
    mateRef: 'ctgB',
    mateStart: bStart,
    tlen: 0,
  })
  aligned({
    name: `mate${i}`,
    flag: 145, // paired, second in pair, reverse
    refName: 'ctgB',
    start: bStart,
    mateRef: 'ctgA',
    mateStart: aStart,
    tlen: 0,
  })
}

// ---------------------------------------------------------------------------
// 3. A DECOY: three pairs from ctgA:20,050 to ctgB:5,900, far from the junction
//    above and clustered enough to clear the floor.
//
// Its job is to be a connection whose far foot is displayed NOWHERE when the
// ctgB window is 2,500-3,500, so it must still draw as the two ticks. Without
// it, "both feet on screen -> one arc" is indistinguishable from "every
// interchromosomal connection -> one arc".
// ---------------------------------------------------------------------------
const DECOY_PAIRS = 3
for (let i = 0; i < DECOY_PAIRS; i++) {
  const aStart = 20_050 + i * 10
  const bStart = 5800 + i * 10 // arc foot at bStart + 100: 5,900 .. 5,920
  aligned({
    name: `decoy${i}`,
    flag: 97,
    refName: 'ctgA',
    start: aStart,
    mateRef: 'ctgB',
    mateStart: bStart,
    tlen: 0,
  })
  aligned({
    name: `decoy${i}`,
    flag: 145,
    refName: 'ctgB',
    start: bStart,
    mateRef: 'ctgA',
    mateStart: aStart,
    tlen: 0,
  })
}

// ---------------------------------------------------------------------------
// 4. SAME-CHROMOSOME long-range pairs, ctgA:20,000 <-> ctgA:30,000, five pairs.
//
// The cross-region case that has nothing to do with chromosomes: shown as two
// ctgA windows either side of the gap, each of these has its two feet in
// different displayed regions, which no per-block pass can join. Shown as one
// window they are ordinary long-insert arcs.
// ---------------------------------------------------------------------------
const FAR_PAIRS = 5
for (let j = 0; j < FAR_PAIRS; j++) {
  const aStart = 20_000 + j * 10
  const bStart = 29_900 + j * 10 // arc foot at bStart + 100: 30,000 .. 30,040
  aligned({
    name: `far${j}`,
    flag: 97,
    refName: 'ctgA',
    start: aStart,
    mateRef: '=',
    mateStart: bStart,
    tlen: 10_000,
  })
  aligned({
    name: `far${j}`,
    flag: 145,
    refName: 'ctgA',
    start: bStart,
    mateRef: '=',
    mateStart: aStart,
    tlen: -10_000,
  })
}

const sam = [
  '@HD\tVN:1.6\tSO:unsorted',
  ...Object.entries(LENGTHS).map(([name, len]) => `@SQ\tSN:${name}\tLN:${len}`),
  ...records,
  '',
].join('\n')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'volvox-translocation-'))
const samPath = path.join(tmp, 'in.sam')
fs.writeFileSync(samPath, sam)
execFileSync('samtools', ['sort', '-o', OUT, samPath], { cwd: dir })
execFileSync('samtools', ['index', OUT], { cwd: dir })
fs.rmSync(tmp, { recursive: true, force: true })
console.log(
  `wrote ${OUT} (+ .bai): ${records.length} records — ` +
    `${SPLIT_MOLECULES} split molecules, ${MATE_PAIRS} mate pairs, ` +
    `${DECOY_PAIRS} decoy pairs, ${FAR_PAIRS} long-range pairs`,
)
