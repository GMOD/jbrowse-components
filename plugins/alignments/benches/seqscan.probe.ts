// Probe, not a bench: is `indexOf` a faster way to find the Nth occurrence of a
// base than a charCodeAt loop, on real read sequences?
//
// The delta walk in `getModPositions` steps one base at a time until it has
// counted past `delta` occurrences of the modified base. That is 43.7M
// charCodeAt iterations over the full extent of 200x.longread.mod.bam.
// `String.prototype.indexOf` for a single character is a native scan, so the
// same walk can be `delta + 1` jumps instead of `distance` steps.
//
// Reports the two against each other, forward strand only, and prints the
// average delta so the ratio has its regime attached — the jump form wins when
// occurrences are sparse and loses when every base is a hit.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

const BAM = join(process.env.HOME!, 'src/jb2bench/data')
const ROUNDS = 15

const path = join(BAM, '200x.longread.mod.bam')
readFileSync(path, { flag: 'r' })
const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
await bam.getHeader()
const records = await bam.getRecordsForRange('chr22_mask', 1, 400000)

interface R {
  seq: string
  deltas: number[]
}
const reads: R[] = []
for (const r of records) {
  const mm = (r.getTag('MM') ?? r.getTag('Mm')) as string | undefined
  if (!mm || r.strand === -1) {
    continue
  }
  const groups = mm.split(';').filter(Boolean)
  if (groups.length !== 1) {
    continue
  }
  const split = groups[0]!.split(',')
  reads.push({ seq: r.seq, deltas: split.slice(1).map(Number) })
}

const totalDeltas = reads.reduce((a, r) => a + r.deltas.length, 0)
const totalBp = reads.reduce((a, r) => a + r.seq.length, 0)
const meanDelta =
  reads.reduce((a, r) => a + r.deltas.reduce((b, d) => b + d, 0), 0) /
  totalDeltas

function stepwise(reads: R[]) {
  let sum = 0
  for (const r of reads) {
    const seq = r.seq
    const seqLength = seq.length
    let currPos = 0
    for (let i = 0; i < r.deltas.length; i++) {
      let delta = r.deltas[i]!
      do {
        if (seq.charCodeAt(currPos) === 67) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < seqLength)
      sum += currPos - 1
    }
  }
  return sum
}

function jumping(reads: R[]) {
  let sum = 0
  for (const r of reads) {
    const seq = r.seq
    const seqLength = seq.length
    let currPos = 0
    for (let i = 0; i < r.deltas.length; i++) {
      const delta = r.deltas[i]!
      let at = -1
      for (let k = 0; k <= delta; k++) {
        at = seq.indexOf('C', currPos)
        if (at < 0) {
          break
        }
        currPos = at + 1
      }
      // Reproduce the stepwise walk's behaviour when the base runs out
      sum += at < 0 ? ((currPos = seqLength), seqLength - 1) : at
    }
  }
  return sum
}

const a = stepwise(reads)
const b = jumping(reads)
const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}
let bestStep = Infinity
let bestJump = Infinity
for (let i = 0; i < ROUNDS; i++) {
  if (i % 2 === 0) {
    bestStep = Math.min(
      bestStep,
      time(() => stepwise(reads)),
    )
    bestJump = Math.min(
      bestJump,
      time(() => jumping(reads)),
    )
  } else {
    bestJump = Math.min(
      bestJump,
      time(() => jumping(reads)),
    )
    bestStep = Math.min(
      bestStep,
      time(() => stepwise(reads)),
    )
  }
}
console.log(
  `${reads.length} forward-strand reads, ${(totalBp / 1e6).toFixed(1)} Mbp, ` +
    `${(totalDeltas / 1e6).toFixed(2)}M deltas, mean delta ${meanDelta.toFixed(1)}\n` +
    `  stepwise (charCodeAt)  ${bestStep.toFixed(1).padStart(7)} ms\n` +
    `  jumping  (indexOf)     ${bestJump.toFixed(1).padStart(7)} ms   ` +
    `${(bestStep / bestJump).toFixed(3)}x   checksums ${a === b ? 'agree' : `DIFFER ${a} vs ${b}`}`,
)
