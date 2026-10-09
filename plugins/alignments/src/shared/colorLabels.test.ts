import { bakedColorScale } from '../LinearAlignmentsDisplay/bakedColorScale.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import {
  LINKED_READ_COLOR_PAIR_RR,
  connectionLabel,
} from '../features/linkedReads/compute.ts'
import { bezierConnectionLegendItems } from '../features/linkedReads/computeOverlay.ts'
import {
  alignmentsColorEncoding,
  colorByOf,
  colorSnapshotFor,
  declaredReadLabels,
  isBakedScheme,
} from './alignmentsColor.ts'
import {
  arcColorCategoryLabel,
  colorRampScales,
  getAlignmentsColorScales,
  getArcLegendItems,
  getReadDisplayLegendItems,
  readCategoryLabelOverrides,
  readColorCategoryLabel,
} from './legendUtils.ts'

import type { ReadColorCategory } from '../LinearAlignmentsDisplay/colorUtils.ts'
import type { AlignmentsColorSetting } from './alignmentsColor.ts'
import type { LegendItem } from '@jbrowse/core/ui'

const UNSET: AlignmentsColorSetting = {
  value: undefined,
  field: '',
  scale: undefined,
  domain: [],
  range: [],
  scheme: undefined,
  reverse: false,
  domainMin: undefined,
  domainMax: undefined,
  domainMid: undefined,
}

function keyOf(
  color: Partial<AlignmentsColorSetting>,
  labels: string[],
  present: ReadColorCategory[],
  presentTagValues?: ReadonlySet<string>,
) {
  const encoding = alignmentsColorEncoding({ ...UNSET, ...color })
  const colorBy = colorByOf(encoding)
  const declared = declaredReadLabels(encoding, labels)
  return {
    declared,
    labels: getReadDisplayLegendItems({
      colorBy,
      palette: makeTestPalette(),
      presentCategories: new Set(present),
      presentTagValues,
      bakedScale: isBakedScheme(colorBy)
        ? bakedColorScale(colorBy, encoding, undefined, undefined)
        : undefined,
      labels: declared,
    }).map(i => i.label),
    hover: (c: ReadColorCategory) =>
      readColorCategoryLabel(
        c,
        readCategoryLabelOverrides(colorBy, declared.categories),
      ),
  }
}

describe('color.labels names the key rows range colors', () => {
  test('a label names the preset level its domain entry names', () => {
    const { labels, hover } = keyOf(
      { field: 'pairOrientation', domain: ['RR', 'LL'] },
      ['Inverted'],
      ['pairLR', 'pairRR', 'pairLL'],
    )
    const own = keyOf({ field: 'pairOrientation' }, [], ['pairLR', 'pairLL'])
    expect(labels.toSorted()).toEqual([...own.labels, 'Inverted'].toSorted())
    expect(hover('pairRR')).toBe('Inverted')
  })

  test("with no domain a preset field's own levels take the labels in order", () => {
    expect(
      keyOf({ field: 'strand' }, ['Plus', 'Minus'], []).declared.categories,
    ).toEqual({ fwdStrand: 'Plus', revStrand: 'Minus' })
    expect(
      keyOf({ field: 'insertSize' }, ['Too close', 'Expected', 'Too far'], [])
        .declared.categories,
    ).toEqual({
      shortInsert: 'Too close',
      normalInsert: 'Expected',
      longInsert: 'Too far',
    })
  })

  test('a tag names its domain values and the read with no value', () => {
    const { labels, hover } = keyOf(
      { field: 'tags.HP', domain: ['1', '2', ''] },
      ['Maternal', 'Paternal', 'Unphased'],
      ['tag', 'noTagValue'],
      new Set(['1', '2']),
    )
    expect(labels).toEqual(['Maternal', 'Paternal', 'Unphased'])
    expect(hover('noTagValue')).toBe('Unphased')
  })

  test('a threshold over a tag names its bins from the lowest', () => {
    expect(
      keyOf(
        { field: 'tags.NM', scale: 'threshold', domain: ['5'] },
        ['Few edits'],
        ['tag'],
      ).labels,
    ).toEqual(['Few edits', 'tags.NM ≥ 5'])
  })

  test('an empty entry keeps its own name', () => {
    expect(
      keyOf(
        { field: 'tags.HP', domain: ['1', '2'] },
        ['', 'Paternal'],
        ['tag'],
        new Set(['1', '2']),
      ).labels,
    ).toEqual(['1', 'Paternal'])
  })

  test('the arc key, the arc hover and the connection curves name the bucket as the read key does', () => {
    const { declared } = keyOf(
      { field: 'pairOrientation', domain: ['RR'] },
      ['Inverted'],
      [],
    )
    const palette = makeTestPalette()
    expect(
      getArcLegendItems(
        new Set(['pairRR']),
        palette,
        false,
        declared.categories,
      )[0]!.label,
    ).toBe('Inverted')
    expect(arcColorCategoryLabel('pairRR', false, declared.categories)).toBe(
      'Inverted',
    )
    expect(
      connectionLabel(LINKED_READ_COLOR_PAIR_RR, declared.categories),
    ).toBe('Inverted')
    expect(
      bezierConnectionLegendItems(
        [LINKED_READ_COLOR_PAIR_RR],
        palette,
        declared.categories,
      )[0]!.label,
    ).toBe('Inverted')
  })
})

describe('color.title heads the key the color object draws', () => {
  const model = (reads: LegendItem[], arcs: LegendItem[] = []) => ({
    legendItems: () => reads,
    arcLegendTitle: 'Arc colors',
    arcLegendItems: () => arcs,
    connectionLegendItems: () => [],
    sashimiLegendItems: [],
  })
  const titles = (scales: ReturnType<typeof getAlignmentsColorScales>) =>
    scales
      .filter(s => s.kind === 'ramp' || s.entries.length > 0)
      .map(s => s.title)
  const HP = [{ color: '#f00', label: '1' }]

  test('unset keeps "Read colors", a title replaces it and "" draws none', () => {
    expect(titles(getAlignmentsColorScales(model(HP)))).toEqual(['Read colors'])
    expect(
      titles(
        getAlignmentsColorScales({ ...model(HP), colorTitle: 'Haplotype' }),
      ),
    ).toEqual(['Haplotype'])
    expect(
      titles(getAlignmentsColorScales({ ...model(HP), colorTitle: '' })),
    ).toEqual([''])
  })

  test('merged with the arcs, the title stands in for "Read"', () => {
    const merged = model(
      [{ color: '#aaa', label: 'LR - Normal pair orientation' }],
      [{ color: '#aaa', label: 'Normal' }],
    )
    expect(
      titles(
        getAlignmentsColorScales({ ...merged, colorTitle: 'Orientation' }),
      ),
    ).toEqual(['Orientation and arc colors'])
    expect(
      titles(getAlignmentsColorScales({ ...merged, colorTitle: '' })),
    ).toEqual([''])
  })

  test('a ramp fill takes the title on its bar and leaves the read rows theirs', () => {
    const ramps = colorRampScales({
      colorBy: { type: 'tag', tag: 'NM' },
      baseLayer: undefined,
      bakedScale: bakedColorScale(
        { type: 'tag', tag: 'NM' },
        { field: 'tags.NM', scale: 'linear', reverse: false },
        undefined,
        [0, 10],
      ),
      tagValueExtent: [0, 10],
      baseQualityExtent: undefined,
    })
    expect(
      titles(
        getAlignmentsColorScales({
          ...model([{ color: '#f0f', label: 'Supplementary/split' }]),
          ramps,
          colorTitle: 'MAPQ',
        }),
      ),
    ).toEqual(['MAPQ', 'Read colors'])
  })
})

test('a scheme pick over the same field keeps the labels and title, a new field drops them', () => {
  const written = {
    ...UNSET,
    field: 'tags.HP',
    domain: ['1', '2'],
    labels: ['Maternal', 'Paternal'],
    title: 'Haplotype',
  }
  expect(colorSnapshotFor({ type: 'tag', tag: 'HP' }, written)).toMatchObject({
    labels: ['Maternal', 'Paternal'],
    title: 'Haplotype',
  })
  expect(
    colorSnapshotFor({ type: 'tag', tag: 'NM' }, written),
  ).not.toHaveProperty('labels')
})
