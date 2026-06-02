import { unmethylated5mC } from '@jbrowse/core/ui/theme'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

import { extractModifications } from './extract.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'

// Forward read with one high-confidence 5mC (read pos 0) and one
// low-confidence 6mA (read pos 2). ML 230 -> ~0.90, ML 50 -> ~0.20.
function makeFeature() {
  return new SimpleFeature({
    uniqueId: 'r1',
    refName: 'ctgA',
    start: 100,
    end: 104,
    strand: 1,
    CIGAR: '4M',
    seq: 'CGAG',
    tags: { MM: 'C+m,0;A+a,0;', ML: [230, 50] },
  })
}

function run(colorBy: ColorBy) {
  const detected = new Set<string>()
  const simplex = new Set<string>()
  const out: ModificationEntry[] = []
  extractModifications(
    makeFeature(),
    'r1',
    100,
    1,
    colorBy,
    detected,
    simplex,
    out,
  )
  return { detected, out }
}

describe('extractModifications', () => {
  test('default mode renders all types above the threshold', () => {
    const { out, detected } = run({
      type: 'modifications',
      modifications: { threshold: 10 },
    })
    expect([...detected].sort()).toEqual(['a', 'm'])
    expect(out.map(m => m.modType).sort()).toEqual(['a', 'm'])
  })

  test('threshold hides low-probability calls', () => {
    const { out } = run({
      type: 'modifications',
      modifications: { threshold: 50 },
    })
    expect(out.map(m => m.modType)).toEqual(['m'])
  })

  test('hiddenModifications hides a type from rendering but still detects all', () => {
    const { out, detected } = run({
      type: 'modifications',
      modifications: { threshold: 10, hiddenModifications: ['a'] },
    })
    expect(out.map(m => m.modType)).toEqual(['m'])
    // the menu list must still offer the hidden type
    expect([...detected].sort()).toEqual(['a', 'm'])
  })

  test('twoColor renders every call, painting low-confidence ones blue', () => {
    const { out } = run({
      type: 'modifications',
      modifications: { threshold: 50, twoColor: true },
    })
    const byType = Object.fromEntries(out.map(m => [m.modType, m]))
    // both present despite threshold 50 (twoColor ignores the threshold)
    expect(Object.keys(byType).sort()).toEqual(['a', 'm'])
    // high-confidence m keeps its modification color (red)
    expect([byType.m!.r, byType.m!.g, byType.m!.b]).toEqual([255, 0, 0])
    // low-confidence a is rendered in the unmethylated/blue color
    const [br, bg, bb] = cssColorToRgb(unmethylated5mC)
    expect([byType.a!.r, byType.a!.g, byType.a!.b]).toEqual([br, bg, bb])
    expect(byType.a!.prob).toBeCloseTo(1 - (50 + 0.5) / 256, 5)
  })
})
