import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getConf, parsePlot } from '@jbrowse/core/configuration'

import { PLOT_EXAMPLES } from './plotExamples.ts'
import { createTestEnvironment } from './testEnv.ts'

function display() {
  return createTestEnvironment().createDisplay().display
}

test('an untouched display declares no plot setting', () => {
  const d = display()
  expect(d.plotKeys).toEqual(
    expect.arrayContaining(['facet', 'color', 'filter']),
  )
  expect(d.plot).toEqual({})
})

test('facet, color and filter read back as the box shows them', () => {
  const d = display()
  expect(
    d.applyDisplaySettings({
      facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
      color: { field: 'subtrack', range: ['red'] },
    }),
  ).toMatchObject({ applied: ['facet', 'color'], failed: [] })
  d.setFilter(["jexl:feature.type == 'gene'"])
  expect(d.facet).toEqual({
    field: 'subtrack',
    domain: ['key5', 'key2', 'key3'],
  })
  expect(d.colorSetting).toMatchObject({
    value: undefined,
    field: 'subtrack',
    scale: undefined,
    domain: [],
    range: ['red'],
  })
  expect(d.colorByAttribute).toBe('subtrack')
  expect(d.plot).toEqual({
    facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
    color: { field: 'subtrack', range: ['red'] },
    filter: ["jexl:feature.type == 'gene'"],
  })
  expect(getConf(d, 'facet')).toEqual({
    field: 'subtrack',
    domain: ['key5', 'key2', 'key3'],
  })
})

test('a string is the one-value form: the facet field, or the constant color', () => {
  const d = display()
  d.applyDisplaySettings({ facet: 'strand', color: 'red' })
  expect(d.facet).toEqual({ field: 'strand', domain: [] })
  expect(d.colorSetting).toMatchObject({ value: 'red', field: '' })
  expect(d.colorByMode).toBe('solid')
  expect(d.plot).toEqual({ facet: 'strand', color: 'red' })
})

test('strand is a field on both channels, painting its own colors', () => {
  const d = display()
  d.applyDisplaySettings({ facet: 'strand', color: { field: 'strand' } })
  expect(d.colorByMode).toBe('strand')
  expect(d.categoricalColorField?.color('1')).toBe('tomato')
  expect(d.categoricalColorField?.color('-1')).toBe('cornflowerblue')
  expect(d.plot).toEqual({ facet: 'strand', color: { field: 'strand' } })
})

test('strand takes a range like any other field', () => {
  const d = display()
  const plot = { color: { field: 'strand', range: ['red', 'blue'] } }
  expect(d.plotProblems(plot)).toEqual([])
  d.applyPlot(plot)
  expect(d.categoricalColorField?.domain).toEqual(['1', '-1', '0'])
  expect(d.categoricalColorField?.color('1')).toBe('red')
  expect(d.categoricalColorField?.color('-1')).toBe('blue')
})

test('an object replaces the setting whole, and null clears it', () => {
  const d = display()
  d.applyPlot({ color: { field: 'source', range: ['red'] } })
  d.applyPlot({ color: 'red' })
  expect(d.colorSetting).toMatchObject({
    value: 'red',
    field: '',
    scale: undefined,
    domain: [],
    range: [],
  })
  d.applyPlot({ facet: 'strand', color: { field: 'type' } })
  d.applyPlot({ color: null })
  expect(d.facet).toMatchObject({ field: 'strand' })
  expect(d.colorSetting).toMatchObject({ value: undefined, field: '' })
  expect(d.plot.color).toBeUndefined()
  d.applyPlot({ facet: { field: 'biotype', domain: ['b', 'a'] } })
  d.applyPlot({ facet: { field: 'biotype' } })
  expect(d.plot.facet).toBe('biotype')
})

test('a domain or range that is not a list is refused, and the display keeps what it had', () => {
  const d = display()
  d.applyDisplaySettings({ color: { field: 'source' } })
  const refused = {
    color: { field: 'source', range: 'red' },
    facet: { field: 'source', domain: 'a' },
  }
  expect(d.applyDisplaySettings(refused)).toMatchObject({
    applied: [],
    failed: [{ key: 'color' }, { key: 'facet' }],
  })
  expect(() => d.plotProblems(refused)).toThrow()
  expect(d.plot.color).toEqual({ field: 'source' })
  expect(d.facet).toBeUndefined()
})

test('an expression that does not compile is a problem, named by setting', () => {
  const d = display()
  expect(
    d.plotProblems({
      color: 'jexl:feature.type ==',
      filter: ['jexl:feature.score >'],
    }),
  ).toEqual([
    expect.stringMatching(/^color: /),
    expect.stringMatching(/^filter: /),
  ])
  expect(d.plotProblems({ color: { field: 'jexl:feature.type ==' } })).toEqual([
    expect.stringMatching(/^color: /),
  ])
  expect(
    d.plotProblems({
      color: { field: 'jexl:feature.type' },
      filter: ['jexl:feature.score > 5'],
    }),
  ).toEqual([])
})

test.each(PLOT_EXAMPLES)(
  'the example $plot parses, passes and applies',
  ({ plot }) => {
    const d = display()
    const draft = parsePlot(plot, d.plotKeys)
    expect(d.plotProblems(draft)).toEqual([])
    d.applyPlot(draft)
    expect(d.plot).toEqual(
      Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== null)),
    )
  },
)

test('the gene track guide prints every example the box lists', () => {
  const guide = readFileSync(
    join(__dirname, '../../../../website/docs/user_guides/gene_track.md'),
    'utf8',
  ).replaceAll(/\n\s*/g, ' ')
  for (const { plot, description } of PLOT_EXAMPLES) {
    expect(guide).toContain(`\`${plot}\` ${description}`)
  }
})

describe('the Group by dialog applies a plot', () => {
  it('keeps the range of the field already painting', () => {
    const d = display()
    d.applyDisplaySettings({
      facet: 'biotype',
      color: { field: 'biotype', range: ['red', 'blue'] },
    })
    d.applyGroupBy('biotype', true)
    expect(d.plot.color).toEqual({
      field: 'biotype',
      range: ['red', 'blue'],
    })
  })

  it('brings back the order and range Solid color parked', () => {
    const d = display()
    d.applyPlot({
      color: { field: 'biotype', domain: ['lncRNA'], range: ['red'] },
    })
    d.setColorValue('purple')
    d.applyGroupBy('biotype', true)
    expect(d.categoricalColorField?.domain).toEqual(['lncRNA'])
    expect(d.categoricalColorField?.color('lncRNA')).toBe('red')
  })

  it('names no color domain from the facet on either route', () => {
    const viaDialog = display()
    const viaText = display()
    for (const d of [viaDialog, viaText]) {
      d.setFacet({ field: 'biotype', domain: ['b'] })
    }
    viaDialog.applyGroupBy('biotype', true)
    viaText.applyPlot({ color: { field: 'biotype' } })
    expect(viaDialog.plot).toEqual(viaText.plot)
    expect(viaText.plot.color).toEqual({ field: 'biotype' })
  })

  it("parks a color that was the grouping's own when unticked, and leaves any other", () => {
    const d = display()
    d.applyGroupBy('strand', true)
    expect(d.groupByPlot(undefined, false)).toEqual({
      facet: null,
      color: { field: 'strand', scale: 'none' },
    })
    d.applyDisplaySettings({ color: 'purple' })
    expect(d.groupByPlot(undefined, false)).toEqual({ facet: null })
  })

  it('keeps a solid color beside the group color on Apply and on Edit plot alike', () => {
    const viaDialog = display()
    const viaText = display()
    for (const d of [viaDialog, viaText]) {
      d.setColorValue('purple')
      d.applyGroupBy('biotype', true)
      expect(d.plot.color).toEqual({ value: 'purple', field: 'biotype' })
    }
    viaDialog.applyGroupBy(undefined, false)
    viaText.applyPlot({
      ...viaText.plot,
      ...viaText.groupByPlot(undefined, false),
    })
    expect(viaDialog.plot).toEqual(viaText.plot)
    expect(viaDialog.colorByMode).toBe('solid')
    expect(viaDialog.solidColor).toBe('purple')
  })

  it('leaves a threshold color alone, ticked on its own field or unticked on another', () => {
    const d = display()
    d.applyDisplaySettings({
      color: { field: 'dif', scale: 'threshold', domain: ['0'] },
    })
    expect(d.groupByPlot('dif', true)).toEqual({
      facet: { field: 'dif' },
    })
    expect(d.groupByPlot('strand', false)).toEqual({
      facet: { field: 'strand' },
    })
  })
})

// The plot is the config as written, so the parked field shows beside the
// constant that paints.
test('Solid color keeps the field, its order and range under scale none for the way back', () => {
  const d = display()
  d.applyPlot({
    color: { field: 'biotype', domain: ['lncRNA'], range: ['red'] },
  })
  d.setColorValue('purple')
  expect(d.colorByMode).toBe('solid')
  expect(d.categoricalColorField).toBeUndefined()
  expect(d.plot.color).toMatchObject({ value: 'purple', scale: 'none' })
  expect(d.colorSetting).toMatchObject({
    value: 'purple',
    field: 'biotype',
    scale: 'none',
  })
  expect(d.colorByAttribute).toBe('biotype')
  d.colorByField('biotype')
  expect(d.colorByMode).toBe('attribute')
  expect(d.categoricalColorField?.domain).toEqual(['lncRNA'])
  expect(d.categoricalColorField?.color('lncRNA')).toBe('red')
  d.setColorValue(undefined)
  expect(d.colorByMode).toBe('default')
  expect(d.colorSetting).toMatchObject({ field: 'biotype', scale: 'none' })
  expect(d.groupByPlot(undefined, false)).toEqual({ facet: null })
})
