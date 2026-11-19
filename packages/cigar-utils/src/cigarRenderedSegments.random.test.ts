import { CIGAR_M } from './cigarConstants.ts'
import { visitCigarPairedIndelSegments } from './cigarPairedIndelSegments.ts'
import { visitCigarRenderedSegments } from './cigarRenderedSegments.ts'
import { coarsenCigar, parseCoarseCigar } from './coarseCigar.ts'
import { parseCigar2 } from './mismatchParser.ts'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function randomCigar(random: () => number) {
  const parts: string[] = []
  for (let k = 0; k < 60; k++) {
    const x = random()
    const len = 1 + Math.floor(random() * 10 ** Math.floor(random() * 5.5))
    parts.push(`${len}${x < 0.5 ? 'M' : x < 0.75 ? 'D' : 'I'}`)
  }
  return parts.join('')
}

function lengths(cigar: string) {
  let own = 0
  let mate = 0
  for (const [, n, op] of cigar.matchAll(/(\d+)([MID])/g)) {
    own += op === 'I' ? 0 : Number(n)
    mate += op === 'D' ? 0 : Number(n)
  }
  return { own, mate }
}

function renderedIndelOps(packed: ArrayLike<number>, bpPerPx: number) {
  const ops: number[] = []
  visitCigarPairedIndelSegments(packed, 0, 0, bpPerPx, bpPerPx, 1, 1, op => {
    if (op !== CIGAR_M) {
      ops.push(op)
    }
  })
  return ops.join(',')
}

const cigars = [
  '1M1000D'.repeat(500),
  '1M1000I'.repeat(500),
  '1I1000D'.repeat(500),
  '1M1000D1M1000I'.repeat(250),
  ...Array.from({ length: 1000 }, (_, i) => randomCigar(seeded(i))),
]

test('a walk emits no more than its op count or twice its widths in pixels', () => {
  for (const cigar of cigars) {
    const packed = parseCigar2(cigar)
    const { own, mate } = lengths(cigar)
    for (const bpPerPx of [10, 1000, 30000]) {
      let emitted = 0
      visitCigarRenderedSegments(packed, 0, 0, bpPerPx, bpPerPx, 1, 1, () => {
        emitted++
      })
      const bound = Math.min(
        packed.length,
        2 * Math.ceil(own / bpPerPx + mate / bpPerPx) + 4,
      )
      expect(emitted).toBeLessThanOrEqual(bound)
    }
  }
})

test('the fine and coarse tiers draw the same indels at coarse zoom', () => {
  let rendered = 0
  for (const cigar of cigars) {
    const fine = parseCigar2(cigar)
    for (const gap of [1000, 10000]) {
      const coarse = parseCoarseCigar(coarsenCigar(cigar, gap).ops)
      for (const bpPerPx of [gap, gap * 1.7, gap * 5]) {
        const fineOps = renderedIndelOps(fine, bpPerPx)
        expect(renderedIndelOps(coarse, bpPerPx)).toBe(fineOps)
        rendered += fineOps.length > 0 ? 1 : 0
      }
    }
  }
  expect(rendered).toBeGreaterThan(1000)
})
