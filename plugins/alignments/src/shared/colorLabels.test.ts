import { colorForField } from '@jbrowse/display-kit/colorConfigSchema'

import { bakedColorScale } from '../LinearAlignmentsDisplay/bakedColorScale.ts'
import { makeTestPalette } from '../LinearAlignmentsDisplay/testUtils.ts'
import {
  connectorColorType,
  pairColorType,
} from '../features/arcs/arcColors.ts'
import { bezierConnectionLegendItems } from '../features/linkedReads/computeOverlay.ts'
import {
  alignmentsColorEncoding,
  readColorFieldOf,
  declaredReadLabels,
  isBakedField,
} from './alignmentsColor.ts'
import { colorSettingOf } from './colorSettingFixture.ts'
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
import type { LegendItem } from '@jbrowse/core/ui'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'

function keyOf(
  color: ColorSlots,
  labels: string[],
  present: ReadColorCategory[],
  presentTagValues?: ReadonlySet<string>,
) {
  const encoding = alignmentsColorEncoding(colorSettingOf(color))
  const colorField = readColorFieldOf(encoding)
  const declared = declaredReadLabels(encoding, labels)
  return {
    declared,
    labels: getReadDisplayLegendItems({
      colorField,
      palette: makeTestPalette(),
      presentCategories: new Set(present),
      presentTagValues,
      bakedScale: isBakedField(colorField)
        ? bakedColorScale(colorField, encoding, undefined, undefined)
        : undefined,
      labels: declared,
    }).map(i => i.label),
    hover: (c: ReadColorCategory) =>
      readColorCategoryLabel(
        c,
        readCategoryLabelOverrides(colorField, declared.categories),
      ),
  }
}

describe('scale.names names the key rows range colors', () => {
  test('a label names the preset level its domain entry names', () => {
    const { labels, hover } = keyOf(
      { field: 'pairOrientation', scale: { domain: ['RR', 'LL'] } },
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
      { field: 'tags.HP', scale: { domain: ['1', '2', ''] } },
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
        { field: 'tags.NM', scale: { type: 'threshold', domain: ['5'] } },
        ['Few edits'],
        ['tag'],
      ).labels,
    ).toEqual(['Few edits', 'tags.NM ≥ 5'])
  })

  test('an empty entry keeps its own name', () => {
    expect(
      keyOf(
        { field: 'tags.HP', scale: { domain: ['1', '2'] } },
        ['', 'Paternal'],
        ['tag'],
        new Set(['1', '2']),
      ).labels,
    ).toEqual(['1', 'Paternal'])
  })

  test('the arc key, the arc hover and the connection curves name the bucket as the read key does', () => {
    const { declared } = keyOf(
      { field: 'pairOrientation', scale: { domain: ['RR'] } },
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
      bezierConnectionLegendItems(
        [connectorColorType(f => pairColorType(f, 3, 0, undefined))],
        palette,
        'pairOrientation',
        false,
        declared.categories,
      )[0]!.label,
    ).toBe('Inverted')
  })
})

describe('legend.title heads the key the color channel draws', () => {
  const model = (reads: LegendItem[], arcs: LegendItem[] = []) => ({
    legendItems: () => reads,
    arcLegendTitle: 'Arc colors',
    arcLegendItems: () => arcs,
    connectionLegendItems: () => [],
    sashimiLegend: { strands: [], splits: [] },
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
      colorField: 'tags.NM',
      baseLayer: undefined,
      bakedScale: bakedColorScale(
        'tags.NM',
        { field: 'tags.NM', scale: 'linear', reverse: false },
        undefined,
        [0, 10],
      ),
      linearFieldExtent: [0, 10],
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

test('a scheme pick over the same field keeps the names and title, a new field drops them', () => {
  const written: ColorSlots = {
    field: 'tags.HP',
    scale: { domain: ['1', '2'], names: ['Maternal', 'Paternal'] },
    legend: { title: 'Haplotype' },
  }
  expect(colorForField(written, 'tags.HP')).toMatchObject({
    scale: { names: ['Maternal', 'Paternal'] },
    legend: { title: 'Haplotype' },
  })
  expect(colorForField(written, 'tags.NM')).not.toHaveProperty('scale')
})
