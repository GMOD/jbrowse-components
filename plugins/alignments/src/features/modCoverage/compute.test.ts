import { abgrBlue, abgrRed } from '@jbrowse/core/util/colorBits'

import { computeModificationCoverage } from './compute.ts'

import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'

// One C position, 10 forward reads, no mismatches → refbase C count = 10.
const POS = 10
const coverage = {
  depths: new Float32Array(20).fill(0),
  maxDepth: 10,
  startPos: 0,
  fwdDepths: new Float32Array(20).fill(0),
  revDepths: new Float32Array(20).fill(0),
}
coverage.depths[POS] = 10
coverage.fwdDepths[POS] = 10
const regionSequence = `${'N'.repeat(POS)  }C`

function modEntry(over: Partial<ModificationEntry>): ModificationEntry {
  return {
    featureId: 'r',
    position: POS,
    base: 'C',
    modType: 'm',
    strand: 1,
    r: 0,
    g: 0,
    b: 0,
    prob: 1,
    noMod: false,
    ...over,
  }
}

const red = modEntry({ r: 255, b: 0, prob: 1, noMod: false })
const blue = modEntry({ r: 0, b: 255, prob: 0.8, noMod: true })

function run(mods: ModificationEntry[]) {
  return computeModificationCoverage(
    mods,
    [],
    0,
    coverage,
    regionSequence,
    0,
    new Set(),
  )
}

test('5mC (red) always stacks below unmodified (blue) regardless of input order', () => {
  for (const mods of [
    [red, blue],
    [blue, red],
  ]) {
    const out = run(mods)
    expect(out.count).toBe(2)
    // bottom segment (yOffset 0) is red; top segment is blue
    expect(out.yOffsets[0]).toBe(0)
    expect(out.yOffsets[1]).toBeGreaterThan(0)
    expect(abgrRed(out.colors[0]!)).toBe(255)
    expect(abgrBlue(out.colors[1]!)).toBe(255)
  }
})

test('bar height is a read count, not a probability-weighted sum', () => {
  // single red read at prob 0.5: height must be (modifiable/depth)*(count/detectable)
  // = (10/10)*(1/10) = 0.1, NOT weighted down to 0.05 by the 0.5 probability.
  const out = run([modEntry({ r: 255, b: 0, prob: 0.5 })])
  expect(out.heights[0]).toBeCloseTo(0.1)
})
