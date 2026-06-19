import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import { detectSimplexModifications } from '@jbrowse/modifications-utils'

import { extractMethylation, extractModifications } from './extract.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { ModificationEntry } from '../../shared/webglRpcTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { ModificationType } from '@jbrowse/modifications-utils'

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
  const seenModTypes = new Map<string, ModificationType>()
  const out: ModificationEntry[] = []
  extractModifications(
    makeFeature(),
    0,
    100,
    1,
    colorBy,
    detected,
    seenModTypes,
    out,
  )
  return { detected, seenModTypes, out }
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

  test('seenModTypes collects strand/type pairs for global simplex resolution', () => {
    // The read carries C+m and A+a, both on '+' with no '-' partner, so both
    // resolve to simplex once detectSimplexModifications runs over the pairs.
    const { seenModTypes } = run({
      type: 'modifications',
      modifications: { threshold: 10 },
    })
    expect([...seenModTypes.keys()].sort()).toEqual(['+a', '+m'])
    const simplex = detectSimplexModifications([...seenModTypes.values()])
    expect([...simplex].sort()).toEqual(['a', 'm'])
  })

  test('methylation mode picks one state per CpG; never paints unmethylated 5hmC', () => {
    // Forward read, 4 CpGs (C at read pos 0,2,4,6). ONT 5mCG_5hmCG models emit
    // a 5hmC probability at every CpG, so the read carries both C+m and C+h.
    // ML byte -> prob = (v+0.5)/256.
    //   CpG0: m=230(.90) h=10(.04)  -> 5mC methylated (red)
    //   CpG1: m=10(.04)  h=10(.04)  -> unmodified     (blue)
    //   CpG2: m=20(.08)  h=220(.86) -> 5hmC           (pink)
    //   CpG3: m=200(.78) h=5(.02)   -> 5mC methylated (red)
    const feature = new SimpleFeature({
      uniqueId: 'meth1',
      refName: 'ctgA',
      start: 100,
      end: 108,
      strand: 1,
      CIGAR: '8M',
      seq: 'CGCGCGCG',
      tags: {
        MM: 'C+m?,0,0,0,0;C+h?,0,0,0,0;',
        ML: [230, 10, 20, 200, 10, 10, 220, 5],
      },
    })
    const colorBy: ColorBy = { type: 'methylation', modifications: {} }
    const out: ModificationEntry[] = []
    const region = { refName: 'ctgA', start: 100, end: 108 } as Region
    const modData = extractModifications(
      feature,
      0,
      100,
      1,
      colorBy,
      new Set<string>(),
      new Map<string, ModificationType>(),
      out,
    )!
    extractMethylation(0, 100, 1, region, modData, out, 'CG')

    // exactly one mark per CpG, no purple unmethylated-5hmC flooding
    expect(out.map(m => m.position)).toEqual([100, 102, 104, 106])
    const rgb = (m: ModificationEntry) => [m.r, m.g, m.b]
    expect(rgb(out[0]!)).toEqual(cssColorToRgb(methylated5mC))
    expect(rgb(out[1]!)).toEqual(cssColorToRgb(unmethylated5mC))
    expect(rgb(out[2]!)).toEqual(cssColorToRgb(methylated5hmC))
    expect(rgb(out[3]!)).toEqual(cssColorToRgb(methylated5mC))
    // unmethylated cytosine reports the no-mod confidence, not 1-hProb purple
    expect(out[1]!.modType).toBe('m')
    expect(out[1]!.prob).toBeCloseTo(1 - (10.5 + 10.5) / 256, 5)
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
