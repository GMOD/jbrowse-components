/* eslint-disable no-console */
// Throwaway: WHERE and HOW do the two backends differ on one snapshot pair?
// The drift percentage says how much; this says whether it is edges (a
// sub-pixel placement difference, small deltas hugging glyph boundaries) or
// fills (a colour difference, large deltas across a glyph's interior).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const name = process.argv[2] ?? 'targeted_alignments-long-reads-sv-linked'
const snap = (backend: string) =>
  PNG.sync.read(
    fs.readFileSync(
      path.join(__dirname, '__snapshots__', backend, `${name}.png`),
    ),
  )

const a = snap('canvas2d')
const b = snap('webgl')
console.log(`${name}: ${a.width}x${a.height} vs ${b.width}x${b.height}`)

const rows = new Map<number, number>()
const deltas = new Map<string, number>()
let differing = 0
for (let y = 0; y < a.height; y++) {
  for (let x = 0; x < a.width; x++) {
    const i = (y * a.width + x) * 4
    const dr = a.data[i]! - b.data[i]!
    const dg = a.data[i + 1]! - b.data[i + 1]!
    const db = a.data[i + 2]! - b.data[i + 2]!
    if (dr === 0 && dg === 0 && db === 0) {
      continue
    }
    differing++
    rows.set(y, (rows.get(y) ?? 0) + 1)
    const key =
      `c2d(${a.data[i]},${a.data[i + 1]},${a.data[i + 2]}) ` +
      `gl(${b.data[i]},${b.data[i + 1]},${b.data[i + 2]})`
    deltas.set(key, (deltas.get(key) ?? 0) + 1)
  }
}

console.log(
  `${differing} differing px of ${a.width * a.height} (${((differing / (a.width * a.height)) * 100).toFixed(2)}%)`,
)
console.log('\nmost common colour pairs:')
for (const [k, n] of [...deltas].sort((x, y) => y[1] - x[1]).slice(0, 12)) {
  console.log(`  ${String(n).padStart(6)}  ${k}`)
}
console.log('\nrows with the most differing px:')
for (const [y, n] of [...rows].sort((p, q) => q[1] - p[1]).slice(0, 10)) {
  console.log(`  y=${String(y).padStart(4)}  ${n}`)
}

// A vertical slice through the hottest row, at a column inside the left read
// cluster: the shape of the disagreement in y is what says whether a mark moved
// or a mark changed weight.
const hotY = [...rows].sort((p, q) => q[1] - p[1])[0]![0]
const col = Number(process.argv[3] ?? 30)
console.log(`\nvertical slice at x=${col}, y=${hotY - 6}..${hotY + 6}:`)
console.log('     y  canvas2d           webgl')
for (let y = hotY - 6; y <= hotY + 6; y++) {
  const i = (y * a.width + col) * 4
  const px = (d: Uint8Array | Buffer) =>
    `(${String(d[i]).padStart(3)},${String(d[i + 1]).padStart(3)},${String(d[i + 2]).padStart(3)})`
  const same =
    a.data[i] === b.data[i] &&
    a.data[i + 1] === b.data[i + 1] &&
    a.data[i + 2] === b.data[i + 2]
  console.log(
    `  ${String(y).padStart(4)}  ${px(a.data)}      ${px(b.data)}  ${same ? '' : '  <-- differs'}`,
  )
}
