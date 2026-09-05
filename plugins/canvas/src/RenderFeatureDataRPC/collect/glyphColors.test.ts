import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { FEATURE_DEFAULT_COLOR, UTR_DEFAULT_COLOR } from '../featureColors.ts'
import { mockDisplayConfig } from '../testUtils.ts'
import { boxColor } from './glyphColors.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function createMockFeature(opts: {
  type?: string
  parent?: () => Feature | undefined
  attrs?: Record<string, unknown>
}): Feature {
  const data: Record<string, unknown> = { type: opts.type, ...opts.attrs }
  return {
    get: (key: string) => data[key],
    parent: opts.parent,
  } as unknown as Feature
}

// A BED12 gene as the glyph actually sees it: itemRgb rides on the mRNA parent
// and the drawn box is a child that carries none of it.
function bed12Child(childType: string, parentItemRgb?: string): Feature {
  const parent = createMockFeature({
    type: 'mRNA',
    attrs: { itemRgb: parentItemRgb },
  })
  return createMockFeature({ type: childType, parent: () => parent })
}

function fill(feature: Feature, config: DisplayConfig = mockDisplayConfig()) {
  return boxColor(feature, { config, colorByCDS: false, jexl }).color
}

describe('boxColor (BED itemRgb)', () => {
  it('inherits itemRgb from the parent for a drawn exon', () => {
    // the box the glyph draws is the child, which carries no itemRgb of its own
    expect(fill(bed12Child('exon', '227,26,28'))).toBe('227,26,28')
  })

  it('colors UTRs with itemRgb too, matching UCSC whole-item coloring', () => {
    expect(fill(bed12Child('five_prime_UTR', '227,26,28'))).toBe('227,26,28')
  })

  it('an explicit color slot beats itemRgb', () => {
    const config = mockDisplayConfig({ color: 'red' })
    expect(fill(bed12Child('exon', '227,26,28'), config)).toBe('red')
  })

  // A `color` expression describes the FEATURE, not the coding part of it, so
  // it has to reach the UTR when nothing else claims the UTR. Without this,
  // "the config beats the file" holds for the exon and not for the UTR of the
  // same transcript, and a per-feature color has to be written out twice —
  // which is exactly what the hosted DTU demo does, carrying the same
  // 300-character jexl in `color` and `utrColor` (review, on
  // dtu/atp5f1c_isoform_switch: "are there any other simplifications,
  // refactorings, bugfixes, or improvements you'd make to this").
  it('a set `color` reaches the UTR when `utrColor` is unset', () => {
    const config = mockDisplayConfig({ color: 'red' })
    expect(fill(bed12Child('five_prime_UTR', '227,26,28'), config)).toBe('red')
    expect(fill(bed12Child('five_prime_UTR'), config)).toBe('red')
  })

  it('an explicit utrColor restores the contrasting-UTR look', () => {
    const config = mockDisplayConfig({ utrColor: 'cyan' })
    expect(fill(bed12Child('five_prime_UTR', '227,26,28'), config)).toBe('cyan')
    // the exon still takes itemRgb — the slots are independent
    expect(fill(bed12Child('exon', '227,26,28'), config)).toBe('227,26,28')
  })

  it('a placeholder itemRgb leaves the defaults alone', () => {
    // every itemRgb in the volvox-bed12 fixture is this placeholder; honoring it
    // would paint an ordinary BED12 gene track black
    expect(fill(bed12Child('exon', '0,0,0'))).toBe(FEATURE_DEFAULT_COLOR)
    expect(fill(bed12Child('five_prime_UTR', '0'))).toBe(UTR_DEFAULT_COLOR)
  })

  it('no itemRgb anywhere on the chain keeps the slot defaults', () => {
    expect(fill(bed12Child('exon'))).toBe(FEATURE_DEFAULT_COLOR)
    expect(fill(bed12Child('five_prime_UTR'))).toBe(UTR_DEFAULT_COLOR)
  })

  it('a parentless feature with its own itemRgb still works (flat BED9)', () => {
    const flat = createMockFeature({
      type: 'block',
      attrs: { itemRgb: '31,120,180' },
    })
    expect(fill(flat)).toBe('31,120,180')
  })
})

describe('boxColor (a per-transcript attribute read from the box)', () => {
  // a per-transcript statistic lives on the transcript row only; the glyph
  // paints one box per child, so the callback reaches up
  const COLOR = "jexl:feature.parent.dtu=='liver'?'#124f95':'#b2b1ac'"

  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'chr1',
    start: 0,
    end: 100,
    type: 'gene',
    subfeatures: [
      {
        uniqueId: 'tx1',
        refName: 'chr1',
        start: 0,
        end: 100,
        type: 'mRNA',
        dtu: 'liver',
        subfeatures: [
          { uniqueId: 'e1', refName: 'chr1', start: 0, end: 100, type: 'exon' },
          { uniqueId: 'c1', refName: 'chr1', start: 20, end: 80, type: 'CDS' },
        ],
      },
    ],
  })
  const config = mockDisplayConfig({ color: COLOR })

  it('every child box resolves the transcript attribute', () => {
    for (const child of gene.get('subfeatures')![0]!.get('subfeatures')!) {
      expect(fill(child, config)).toBe('#124f95')
    }
  })

  // No guard needed: member access on a nullish subject is undefined in the
  // jexl fork, not a throw. Only an undefined RESULT falls back to magenta.
  it('a rootless feature takes the default branch, not the invalid-color fallback', () => {
    const orphan = new SimpleFeature({
      uniqueId: 'o1',
      refName: 'chr1',
      start: 0,
      end: 10,
      type: 'mRNA',
    })
    expect(fill(orphan, config)).toBe('#b2b1ac')
    expect(
      fill(orphan, mockDisplayConfig({ color: 'jexl:feature.parent.dtu' })),
    ).toBe('magenta')
  })
})

describe('boxColor (an explicit color always beats the file)', () => {
  const itemRgbFeature = createMockFeature({
    type: 'block',
    attrs: { itemRgb: '227,26,28' },
  })

  // the reason `color` is a maybeColor: with a concrete 'goldenrod' default,
  // stripDefault erased an explicit goldenrod, making it indistinguishable from
  // unset — so itemRgb swallowed the one color a user is most likely to write
  it('honors an explicit color even when it equals the fallback', () => {
    expect(
      fill(itemRgbFeature, mockDisplayConfig({ color: FEATURE_DEFAULT_COLOR })),
    ).toBe(FEATURE_DEFAULT_COLOR)
  })

  it('honors an explicit utrColor even when it equals the fallback', () => {
    const utr = createMockFeature({
      type: 'five_prime_UTR',
      attrs: { itemRgb: '227,26,28' },
    })
    expect(fill(utr, mockDisplayConfig({ utrColor: UTR_DEFAULT_COLOR }))).toBe(
      UTR_DEFAULT_COLOR,
    )
  })

  it('still yields to the file when unset', () => {
    expect(fill(itemRgbFeature)).toBe('227,26,28')
  })
})
