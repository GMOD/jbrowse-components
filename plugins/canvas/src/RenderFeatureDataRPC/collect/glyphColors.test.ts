import { categoricalColor } from '@jbrowse/core/ui/colors'
import { SimpleFeature } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { FEATURE_DEFAULT_COLOR, UTR_DEFAULT_COLOR } from '../featureColors.ts'
import { mockDisplayConfig } from '../testUtils.ts'
import { createColorKey } from './colorKey.ts'
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

// itemRgb rides on the mRNA parent, and the box the glyph draws is a child that
// carries none of it.
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
    expect(fill(bed12Child('exon', '227,26,28'))).toBe('227,26,28')
  })

  it('colors UTRs with itemRgb too, matching UCSC whole-item coloring', () => {
    expect(fill(bed12Child('five_prime_UTR', '227,26,28'))).toBe('227,26,28')
  })

  it('an explicit color slot beats itemRgb', () => {
    const config = mockDisplayConfig({ color: 'red' })
    expect(fill(bed12Child('exon', '227,26,28'), config)).toBe('red')
  })

  it('a set `color` reaches the UTR when `utrColor` is unset', () => {
    const config = mockDisplayConfig({ color: 'red' })
    expect(fill(bed12Child('five_prime_UTR', '227,26,28'), config)).toBe('red')
    expect(fill(bed12Child('five_prime_UTR'), config)).toBe('red')
  })

  it('an explicit utrColor restores the contrasting-UTR look', () => {
    const config = mockDisplayConfig({ utrColor: 'cyan' })
    expect(fill(bed12Child('five_prime_UTR', '227,26,28'), config)).toBe('cyan')
    expect(fill(bed12Child('exon', '227,26,28'), config)).toBe('227,26,28')
  })

  it('a placeholder itemRgb leaves the defaults alone', () => {
    // Every itemRgb in the volvox-bed12 fixture is this placeholder, and
    // honoring it would paint an ordinary BED12 gene track black.
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
  // The statistic lives on the transcript row only and the glyph paints one box
  // per child, so the callback has to reach up.
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

  // Member access on a nullish subject is undefined in the jexl fork, not a
  // throw, so only an undefined RESULT falls back to magenta.
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

describe('boxColor (color by a field)', () => {
  const gene = new SimpleFeature({
    uniqueId: 'gene1',
    refName: 'chr1',
    start: 0,
    end: 300,
    type: 'gene',
    gene_biotype: 'protein_coding',
    subfeatures: [
      {
        uniqueId: 'tx1',
        refName: 'chr1',
        start: 0,
        end: 100,
        type: 'mRNA',
        strand: 1,
        subfeatures: [
          { uniqueId: 'e1', refName: 'chr1', start: 0, end: 100, type: 'exon' },
          {
            uniqueId: 'c1',
            refName: 'chr1',
            start: 20,
            end: 80,
            type: 'CDS',
            strand: 1,
            phase: 0,
            protein_id: 'P1',
          },
        ],
      },
      {
        uniqueId: 'tx2',
        refName: 'chr1',
        start: 200,
        end: 300,
        type: 'lnc_RNA',
        transcript_biotype: 'lncRNA',
      },
    ],
  })
  const [transcript, childless] = gene.get('subfeatures')!
  const parts = transcript!.get('subfeatures')!

  function painter(
    colorField: string,
    extra: Partial<DisplayConfig> = {},
    colorByCDS = false,
  ) {
    const config = mockDisplayConfig({ colorField, ...extra })
    const colorKey = createColorKey(config, jexl)!
    colorKey.enterRecord({ strand: undefined, groupKey: undefined })
    const ctx = { config, colorByCDS, jexl }
    return {
      paint: (box: Feature, level?: Feature) =>
        boxColor(box, ctx, colorKey, level).color,
      labels: () => colorKey.candidates.map(c => c.value),
    }
  }

  it("paints a transcript and its parts in the gene's value, over the color slot", () => {
    const { paint, labels } = painter('gene_biotype', { color: 'red' })
    for (const part of parts) {
      expect(paint(part, transcript)).toBe(categoricalColor('protein_coding'))
    }
    expect(paint(transcript!)).toBe(categoricalColor('protein_coding'))
    expect(labels()).toEqual(['protein_coding'])
  })

  it("paints a transcript's parts in the transcript's value, not each part's", () => {
    const { paint, labels } = painter('type')
    for (const part of parts) {
      expect(paint(part, transcript)).toBe(categoricalColor('mRNA'))
    }
    expect(labels()).toEqual(['mRNA'])
  })

  it('paints a transcript with no parts in its own value', () => {
    const { paint } = painter('transcript_biotype')
    expect(paint(childless!)).toBe(categoricalColor('lncRNA'))
    expect(painter('type').paint(childless!)).toBe(categoricalColor('lnc_RNA'))
  })

  it('reads a field only the parts carry off the part', () => {
    const { paint } = painter('protein_id')
    expect(paint(parts[1]!, transcript)).toBe(categoricalColor('P1'))
    expect(paint(parts[0]!, transcript)).toBe(categoricalColor(undefined))
  })

  it('records a value-less box under the no-value key', () => {
    const { paint, labels } = painter('missing')
    expect(paint(parts[0]!, transcript)).toBe(categoricalColor(undefined))
    expect(labels()).toEqual([''])
  })

  it('names nothing for a CDS the reading frame paints instead', () => {
    const { paint, labels } = painter('protein_id', {}, true)
    expect(paint(parts[1]!, transcript)).toBeUndefined()
    expect(labels()).toEqual([])
  })

  it('paints a feature with no strand as unstranded', () => {
    const { paint } = painter('strand')
    expect(paint(childless!)).toBe('goldenrod')
    expect(paint(parts[1]!, transcript)).toBe('tomato')
  })

  it('reads a jexl field', () => {
    const { paint } = painter("jexl:get(feature,'type') + '!'")
    expect(paint(parts[0]!, transcript)).toBe(categoricalColor('mRNA!'))
  })
})

describe('boxColor (an explicit color always beats the file)', () => {
  const itemRgbFeature = createMockFeature({
    type: 'block',
    attrs: { itemRgb: '227,26,28' },
  })

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
