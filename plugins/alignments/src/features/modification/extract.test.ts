import {
  methylated5hmC,
  methylated5mC,
  unmethylated5mC,
} from '@jbrowse/core/ui/theme'
import { SimpleFeature } from '@jbrowse/core/util'
import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'
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

  test('shownModifications allow-list renders only the listed type but still detects all', () => {
    const { out, detected } = run({
      type: 'modifications',
      modifications: { threshold: 10, shownModifications: ['a'] },
    })
    expect(out.map(m => m.modType)).toEqual(['a'])
    // detection is unaffected — the menu still offers every detected type
    expect([...detected].sort()).toEqual(['a', 'm'])
  })

  test('shownModifications wins over hiddenModifications when both are set', () => {
    const { out } = run({
      type: 'modifications',
      modifications: {
        threshold: 10,
        shownModifications: ['a'],
        hiddenModifications: ['a'],
      },
    })
    expect(out.map(m => m.modType)).toEqual(['a'])
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
    const colorBy: ColorBy = {
      type: 'modifications',
      modifications: { fillUnmarked: true },
    }
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
    extractMethylation(0, 100, 1, region, modData, out, colorBy.modifications)

    // exactly one mark per CpG, no purple unmethylated-5hmC flooding
    expect(out.map(m => m.position)).toEqual([100, 102, 104, 106])
    expect(out[0]!.color).toBe(cssColorToABGR(methylated5mC))
    expect(out[1]!.color).toBe(cssColorToABGR(unmethylated5mC))
    expect(out[2]!.color).toBe(cssColorToABGR(methylated5hmC))
    expect(out[3]!.color).toBe(cssColorToABGR(methylated5mC))
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
    expect(byType.m!.color).toBe(packAbgr(255, 0, 0, 255))
    // low-confidence a is rendered in the unmethylated/blue color
    expect(byType.a!.color).toBe(cssColorToABGR(unmethylated5mC))
    expect(byType.a!.prob).toBeCloseTo(1 - (50 + 0.5) / 256, 5)
  })
})

// The fill view, driven the way `extractFeatureArrays` drives it: the MM/ML
// paint and the cytosine walk are two calls that between them cover a read's
// types once each. Both bugs below were in the seam between them.
function runFill(feature: SimpleFeature, colorBy: ColorBy) {
  const out: ModificationEntry[] = []
  const region = { refName: 'ctgA', start: 100, end: 120 } as Region
  const modData = extractModifications(
    feature,
    0,
    100,
    1,
    colorBy,
    new Set<string>(),
    new Map<string, ModificationType>(),
    out,
  )
  if (modData) {
    extractMethylation(0, 100, 1, region, modData, out, colorBy.modifications)
  }
  return out
}

// Forward read, 4 CpGs at read pos 0,2,4,6, called by both C+m and C+h.
//   CpG0: m=230(.90) h=10(.04)  -> 5mC
//   CpG1: m=10(.04)  h=10(.04)  -> unmodified
//   CpG2: m=20(.08)  h=220(.86) -> 5hmC
//   CpG3: m=200(.78) h=5(.02)   -> 5mC
function makeMethFeature() {
  return new SimpleFeature({
    uniqueId: 'meth2',
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
}

describe('the fill view honours the modification-type filter', () => {
  test('every type ticked draws the same marks as no filter at all', () => {
    const unfiltered = runFill(makeMethFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true },
    })
    const allTicked = runFill(makeMethFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true, shownModifications: ['m', 'h'] },
    })
    expect(allTicked).toEqual(unfiltered)
    expect(unfiltered.map(m => m.modType)).toEqual(['m', 'm', 'h', 'm'])
  })

  // The bug: extractMethylation read no colorBy, so the checkboxes were inert
  // here while the legend read the same predicate and dropped the swatch — a
  // magenta mark on screen with nothing keying it.
  test('unticking 5hmC leaves no 5hmC mark', () => {
    const out = runFill(makeMethFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true, shownModifications: ['m'] },
    })
    expect(out.map(m => m.modType)).not.toContain('h')
  })

  // ...and the cytosine it won at still reads 5mC-or-not rather than going
  // blank, which is what "untick 5hmC to read gene-body 5mC" asks for.
  test('a cytosine 5hmC won falls back to the 5mC-vs-unmodified call', () => {
    const out = runFill(makeMethFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true, shownModifications: ['m'] },
    })
    expect(out.map(m => m.position)).toEqual([100, 102, 104, 106])
    // CpG2 was 5hmC; with only 5mC ticked its m=20(.08) loses to 1-.08
    const cpg2 = out.find(m => m.position === 104)!
    expect(cpg2.color).toBe(cssColorToABGR(unmethylated5mC))
    expect(cpg2.noMod).toBe(true)
    // blue is now 1 - P(5mC) alone: the hidden channel leaves the no-mod sum
    expect(cpg2.prob).toBeCloseTo(1 - 20.5 / 256, 5)
  })

  // The limit of "excluded from the competition, not from the output". A
  // cytosine reaches the walk through a ticked type's bins, and on an m-only
  // modBAM the h channel has none — so unticking 5mC empties the view rather
  // than turning every cytosine blue. There is nothing left to read
  // 5hmC-or-not against, and the docstring says so.
  test('unticking the only type a read declares empties the channel', () => {
    const mOnly = new SimpleFeature({
      uniqueId: 'meth-m-only',
      refName: 'ctgA',
      start: 100,
      end: 108,
      strand: 1,
      CIGAR: '8M',
      seq: 'CGCGCGCG',
      tags: { MM: 'C+m?,0,0,0,0;', ML: [230, 10, 20, 200] },
    })
    const fill = (shownModifications: string[]) =>
      runFill(mOnly, {
        type: 'modifications',
        modifications: { fillUnmarked: true, shownModifications },
      })
    expect(fill(['m']).map(m => m.position)).toEqual([100, 102, 104, 106])
    expect(fill(['h'])).toEqual([])
  })

  test('unticking every type draws nothing', () => {
    const out = runFill(makeMethFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true, shownModifications: [] },
    })
    expect(out).toEqual([])
  })
})

describe('the fill view keeps a read’s non-cytosine modifications', () => {
  // Fiber-seq shape: 5mC on C and 6mA on A in one read. getMethBins is
  // cytosine-only, so handing it the whole paint dropped every 6mA call —
  // the 2-color radio, which is what writes fillUnmarked for cytosine data,
  // silently threw the adenine channel away.
  function makeFiberseqFeature() {
    return new SimpleFeature({
      uniqueId: 'fs1',
      refName: 'ctgA',
      start: 100,
      end: 108,
      strand: 1,
      CIGAR: '8M',
      seq: 'CGACGATA',
      tags: { MM: 'C+m?,0,0;A+a,0,0,0;', ML: [230, 200, 240, 250, 245] },
    })
  }

  test('6mA is drawn in the fill view, at the same positions as by-type', () => {
    const byType = runFill(makeFiberseqFeature(), {
      type: 'modifications',
      modifications: { twoColor: true },
    })
    const fill = runFill(makeFiberseqFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true },
    })
    const adenine = (out: ModificationEntry[]) =>
      out.filter(m => m.modType === 'a').map(m => m.position)
    expect(adenine(byType)).toEqual([102, 105, 107])
    expect(adenine(fill)).toEqual(adenine(byType))
  })

  test('the cytosines are still painted once, by the fill walk', () => {
    const fill = runFill(makeFiberseqFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true },
    })
    // C at read pos 0 and 3, each drawn exactly once — the MM/ML paint skips
    // 5mC precisely so the cytosine walk owns it
    expect(fill.filter(m => m.modType === 'm').map(m => m.position)).toEqual([
      100, 103,
    ])
  })

  test('the type filter reaches the non-cytosine half too', () => {
    const out = runFill(makeFiberseqFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true, shownModifications: ['m'] },
    })
    expect(out.map(m => m.modType)).not.toContain('a')
  })

  test('a read with only cytosine types is unchanged', () => {
    const before = runFill(makeMethFeature(), {
      type: 'modifications',
      modifications: { fillUnmarked: true },
    })
    expect(before.map(m => [m.position, m.modType])).toEqual([
      [100, 'm'],
      [102, 'm'],
      [104, 'h'],
      [106, 'm'],
    ])
  })
})
