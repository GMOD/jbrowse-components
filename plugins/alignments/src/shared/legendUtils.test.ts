import { getReadDisplayLegendItems } from './legendUtils.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'

import type { ColorSchemeType, ModificationTypeWithColor } from './types.ts'
import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'

function labels(
  type: ColorSchemeType,
  categories: ReadColorCategory[],
  visibleModifications?: Map<string, ModificationTypeWithColor>,
) {
  return getReadDisplayLegendItems(
    { type },
    new Set(categories),
    makeTestPalette(),
    visibleModifications,
  ).map(i => i.label)
}

function tagLabels(
  colorBy: { type: 'tag'; tag: string },
  colorTagMap?: Record<string, string>,
) {
  return getReadDisplayLegendItems(
    colorBy,
    new Set<ReadColorCategory>(['tag']),
    makeTestPalette(),
    undefined,
    colorTagMap,
  ).map(i => i.label)
}

describe('getReadDisplayLegendItems', () => {
  test('lists only the buckets present in the reads', () => {
    expect(labels('insertSize', ['normalInsert'])).toEqual(['Normal'])
    expect(labels('insertSize', ['normalInsert', 'longInsert'])).toEqual([
      'Normal',
      'Long insert',
    ])
  })

  test('omits "Supplementary/split" when no supplementary reads are present', () => {
    expect(labels('insertSize', ['normalInsert'])).not.toContain(
      'Supplementary/split',
    )
    expect(labels('strand', ['fwdStrand'])).toEqual(['Forward strand'])
  })

  test('strand scheme lists only forward/reverse — a read always has a strand', () => {
    // noStrand is never a real read bucket (strand is derived from the 0x10 flag,
    // always ±1), so the legend never advertises a "No strand" swatch.
    expect(labels('strand', ['fwdStrand', 'revStrand'])).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  test('pair-orientation scheme: split-read strand framing + non-split bucket', () => {
    // fwd/rev come only from split segments here, and po=0 non-split reads are
    // their own grey bucket.
    expect(
      labels('pairOrientation', [
        'fwdStrand',
        'revStrand',
        'nonSplit',
        'pairLR',
      ]),
    ).toEqual([
      'Split read (forward)',
      'Split read (reverse)',
      'Unsplit read',
      'LR - Normal pair orientation',
    ])
  })

  test('includes "Supplementary/split" only when that bucket occurs', () => {
    expect(labels('insertSize', ['normalInsert', 'supplementary'])).toContain(
      'Supplementary/split',
    )
    expect(labels('strand', ['fwdStrand', 'supplementary'])).toEqual([
      'Forward strand',
      'Supplementary/split',
    ])
  })

  test('pair orientation lists only the orientations seen', () => {
    expect(labels('pairOrientation', ['pairLR', 'pairRL'])).toEqual([
      'LR - Normal pair orientation',
      'RL - Mates point outward',
    ])
  })

  test('normal scheme shows a base-reads swatch plus any cross-cutting buckets', () => {
    // a single "Reads" entry so "Show legend" is never a silent no-op
    expect(labels('normal', ['plain'])).toEqual(['Reads'])
    // chain mode still surfaces unmapped/supplementary after the base swatch
    expect(labels('normal', ['plain', 'unmappedMate'])).toEqual([
      'Reads',
      'Unmapped mate',
    ])
  })

  test('chain-mode split reads read as "Split read" under any non-strand scheme', () => {
    // In linked-reads mode only the split segments pick up a fwd/rev color while
    // ordinary reads stay grey; a fwd/rev bucket here can only be a split, so it
    // must not read as a plain "Forward strand".
    expect(labels('normal', ['plain', 'fwdStrand', 'revStrand'])).toEqual([
      'Reads',
      'Split read (forward)',
      'Split read (reverse)',
    ])
    // swatches follow CATEGORY_LEGEND order (strand buckets precede insert ones)
    expect(labels('insertSize', ['normalInsert', 'fwdStrand'])).toEqual([
      'Split read (forward)',
      'Normal',
    ])
    expect(labels('mappingQuality', ['fwdStrand'])).toEqual([
      'MAPQ 0',
      'MAPQ 30',
      'MAPQ ≥60',
      'Split read (forward)',
    ])
  })

  test('the plain strand scheme keeps the plain wording (fwd/rev is its primary key)', () => {
    // Under strand, every read is colored by its own strand, so a fwd/rev bucket
    // is the key itself, not a split-read exception.
    expect(labels('strand', ['fwdStrand', 'revStrand'])).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  test('first-of-pair-strand names the fragment strand, not the read’s own strand', () => {
    // The color is the strand inferred from the first mate, so a reverse-mapped
    // read1 lands in the "forward" bucket — spell that out.
    expect(labels('firstOfPairStrand', ['fwdStrand', 'revStrand'])).toEqual([
      'Forward (first-in-pair)',
      'Reverse (first-in-pair)',
    ])
  })

  test('modifications view surfaces chain-mode split reads after the mod-type key', () => {
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
    ])
    expect(labels('modifications', ['fwdStrand', 'revStrand'], mods)).toEqual([
      '5mC',
      'Split read (forward)',
      'Split read (reverse)',
    ])
  })

  test('value tag scheme lists discovered tag values sorted, colored from the map', () => {
    expect(
      tagLabels({ type: 'tag', tag: 'HP' }, { '2': 'blue', '1': 'red' }),
    ).toEqual(['1', '2'])
    // empty until reads with the tag load
    expect(tagLabels({ type: 'tag', tag: 'HP' }, {})).toEqual([])
    expect(tagLabels({ type: 'tag', tag: 'HP' })).toEqual([])
  })

  test('value tag swatch colors come straight from colorTagMap', () => {
    const items = getReadDisplayLegendItems(
      { type: 'tag', tag: 'HP' },
      new Set<ReadColorCategory>(['tag']),
      makeTestPalette(),
      undefined,
      { '1': 'red', '2': 'blue' },
    )
    expect(items).toEqual([
      { color: 'red', label: '1' },
      { color: 'blue', label: '2' },
    ])
  })

  test('strand-encoding tags (XS/TS/ts) show the strand key, not a value list', () => {
    // just the two strand keys; untagged reads fall back to the neutral color
    // with no legend swatch of its own
    expect(tagLabels({ type: 'tag', tag: 'ts' }, { foo: 'red' })).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
    expect(tagLabels({ type: 'tag', tag: 'XS' })).toEqual([
      'Forward strand',
      'Reverse strand',
    ])
  })

  test('mapping quality is a fixed ramp regardless of present buckets', () => {
    expect(labels('mappingQuality', [])).toEqual([
      'MAPQ 0',
      'MAPQ 30',
      'MAPQ ≥60',
    ])
  })

  test('modifications list visible mod types by friendly name, gating supplementary on presence', () => {
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
      ['h', { color: 'blue', type: 'h', base: 'C', strand: '+' }],
    ])
    expect(labels('modifications', [], mods)).toEqual(['5mC', '5hmC'])
    expect(labels('modifications', ['supplementary'], mods)).toEqual([
      '5mC',
      '5hmC',
      'Supplementary/split',
    ])
  })

  test('hiddenModifications drops the swatch even though the type was detected', () => {
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
      ['h', { color: 'blue', type: 'h', base: 'C', strand: '+' }],
      ['a', { color: 'purple', type: 'a', base: 'A', strand: '+' }],
    ])
    expect(
      getReadDisplayLegendItems(
        {
          type: 'modifications',
          modifications: { hiddenModifications: ['m', 'h'] },
        },
        new Set(),
        makeTestPalette(),
        mods,
      ).map(i => i.label),
    ).toEqual(['6mA'])
  })

  test('shownModifications allow-list keeps only the listed swatch', () => {
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
      ['h', { color: 'blue', type: 'h', base: 'C', strand: '+' }],
      ['a', { color: 'purple', type: 'a', base: 'A', strand: '+' }],
    ])
    expect(
      getReadDisplayLegendItems(
        {
          type: 'modifications',
          modifications: { shownModifications: ['a'] },
        },
        new Set(),
        makeTestPalette(),
        mods,
      ).map(i => i.label),
    ).toEqual(['6mA'])
  })

  test('fill-unmarked (methylation) view keys the states it paints, incl. the blue unmethylated swatch', () => {
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
      ['h', { color: 'magenta', type: 'h', base: 'C', strand: '+' }],
    ])
    const items = getReadDisplayLegendItems(
      { type: 'modifications', modifications: { fillUnmarked: true } },
      new Set(),
      makeTestPalette(),
      mods,
    )
    expect(items).toEqual([
      { color: '#ff0000', label: '5mC methylated' },
      { color: '#ffc0cb', label: '5hmC methylated' },
      { color: '#0000ff', label: 'Unmethylated' },
    ])
  })

  test('bisulfite view keys the unmethylated state it paints, like fill-unmarked', () => {
    // bisulfite paints methylated (5mC red) + unmethylated (blue) cytosines, so
    // its legend must surface the "Unmethylated" swatch rather than only "5mC".
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
    ])
    expect(labels('bisulfite', [], mods)).toEqual(['5mC methylated', 'Unmethylated'])
  })

  test('fill-unmarked view omits the 5hmC swatch when only 5mC was detected', () => {
    const mods = new Map([
      ['m', { color: 'red', type: 'm', base: 'C', strand: '+' }],
    ])
    expect(
      getReadDisplayLegendItems(
        { type: 'modifications', modifications: { fillUnmarked: true } },
        new Set(),
        makeTestPalette(),
        mods,
      ).map(i => i.label),
    ).toEqual(['5mC methylated', 'Unmethylated'])
  })

  test('swatch colors come from the live palette when provided', () => {
    const palette = makeTestPalette({
      colorFwdStrand: [0, 0, 1],
      colorSupplementary: [0, 1, 0],
    })
    const items = getReadDisplayLegendItems(
      { type: 'strand' },
      new Set<ReadColorCategory>(['fwdStrand', 'supplementary']),
      palette,
    )
    expect(items).toEqual([
      { color: 'rgb(0,0,255)', label: 'Forward strand' },
      { color: 'rgb(0,255,0)', label: 'Supplementary/split' },
    ])
  })
})
