import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getConf, parsePlot } from '@jbrowse/core/configuration'
import { onPatch } from '@jbrowse/mobx-state-tree'

import { PLOT_EXAMPLES } from './plotExamples.ts'
import { createTestEnvironment } from './testEnv.ts'

function display() {
  return createTestEnvironment().createDisplay().display
}

test('an untouched display declares no plot setting', () => {
  const d = display()
  expect(d.plotKeys).toEqual(
    expect.arrayContaining(['facet', 'encoding', 'filter', 'legend']),
  )
  expect(d.plot).toEqual({})
})

test('facet, color and filter read back as the box shows them', () => {
  const d = display()
  expect(
    d.applyDisplaySettings({
      facet: { field: 'subtrack', sort: ['key5', 'key2', 'key3'] },
      encoding: { color: { field: 'subtrack', scale: { range: ['red'] } } },
    }),
  ).toMatchObject({ applied: ['facet', 'encoding'], failed: [] })
  d.setFilter(["jexl:feature.type == 'gene'"])
  expect(d.facet).toEqual({
    field: 'subtrack',
    sort: ['key5', 'key2', 'key3'],
  })
  expect(d.colorSetting).toMatchObject({
    value: undefined,
    field: 'subtrack',
    scale: { type: undefined, domain: [], range: ['red'] },
  })
  expect(d.colorByAttribute).toBe('subtrack')
  expect(d.plot).toEqual({
    facet: { field: 'subtrack', sort: ['key5', 'key2', 'key3'] },
    encoding: { color: { field: 'subtrack', scale: { range: ['red'] } } },
    filter: ["jexl:feature.type == 'gene'"],
  })
  expect(getConf(d, 'facet')).toEqual({
    field: 'subtrack',
    sort: ['key5', 'key2', 'key3'],
  })
})

// A plot's `filter` is the whole list, as Vega-Lite's is, and an entry the
// bare-string form says prints as that string
test("a plot's filter list is written whole", () => {
  const d = display()
  d.setGenesFilter('only')
  expect(d.plot).toEqual({ filter: ['geneLike'] })
  d.applyPlot({ filter: ['jexl:feature.score > 5', 'geneLike'] })
  expect(d.plot).toEqual({ filter: ['jexl:feature.score > 5', 'geneLike'] })
  d.applyPlot({ filter: ['jexl:feature.score > 5'] })
  expect(d.genesFilter).toBeUndefined()
  d.applyPlot({ filter: [{ field: 'score', gte: 5 }] })
  expect(d.plot).toEqual({ filter: [{ field: 'score', gte: 5 }] })
})

test('a string is the one-value form of a field, on the facet and the color alike', () => {
  const d = display()
  d.applyDisplaySettings({ facet: 'strand', encoding: { color: 'source' } })
  expect(d.facet).toEqual({ field: 'strand', sort: [] })
  expect(d.colorSetting).toMatchObject({ value: undefined, field: 'source' })
  expect(d.colorByMode).toBe('attribute')
  expect(d.plot).toEqual({ facet: 'strand', encoding: { color: 'source' } })
})

test('a bare CSS color is refused as a field, and the constant is { value }', () => {
  const d = display()
  expect(d.applyDisplaySettings({ encoding: { color: 'red' } })).toMatchObject({
    applied: [],
    failed: [{ key: 'encoding', error: expect.stringContaining('"value"') }],
  })
  d.applyDisplaySettings({ encoding: { color: { value: 'red' } } })
  expect(d.colorSetting).toMatchObject({ value: 'red', field: '' })
  expect(d.colorByMode).toBe('solid')
  expect(d.plot).toEqual({ encoding: { color: { value: 'red' } } })
})

test('strand is a field on both channels, painting its own colors', () => {
  const d = display()
  d.applyDisplaySettings({ facet: 'strand', encoding: { color: 'strand' } })
  expect(d.colorByMode).toBe('strand')
  expect(d.categoricalColorField?.color('1')).toBe('tomato')
  expect(d.categoricalColorField?.color('-1')).toBe('cornflowerblue')
  expect(d.plot).toEqual({ facet: 'strand', encoding: { color: 'strand' } })
})

test('strand takes a range like any other field', () => {
  const d = display()
  const plot = {
    encoding: { color: { field: 'strand', scale: { range: ['red', 'blue'] } } },
  }
  expect(d.plotProblems(plot)).toEqual([])
  d.applyPlot(plot)
  expect(d.categoricalColorField?.domain).toEqual(['1', '-1', '0'])
  expect(d.categoricalColorField?.color('1')).toBe('red')
  expect(d.categoricalColorField?.color('-1')).toBe('blue')
})

test('a channel object replaces the setting whole, and null clears it', () => {
  const d = display()
  d.applyPlot({
    encoding: { color: { field: 'source', scale: { range: ['red'] } } },
  })
  d.applyPlot({ encoding: { color: { value: 'red' } } })
  expect(d.colorSetting).toMatchObject({
    value: 'red',
    field: '',
    scale: { type: undefined, domain: [], range: [] },
  })
  d.applyPlot({ facet: 'strand', encoding: { color: 'type' } })
  d.applyPlot({ encoding: { color: null } })
  expect(d.facet).toMatchObject({ field: 'strand' })
  expect(d.colorSetting).toMatchObject({ value: undefined, field: '' })
  expect(d.plot.encoding).toBeUndefined()
  d.applyPlot({ facet: { field: 'biotype', sort: ['b', 'a'] } })
  d.applyPlot({ facet: { field: 'biotype' } })
  expect(d.plot.facet).toBe('biotype')
})

test('a domain or range that is not a list is refused, and the display keeps what it had', () => {
  const d = display()
  d.applyDisplaySettings({ encoding: { color: 'source' } })
  const refused = {
    encoding: { color: { field: 'source', scale: { range: 'red' } } },
    facet: { field: 'source', sort: 'a' },
  }
  expect(d.applyDisplaySettings(refused)).toMatchObject({
    applied: [],
    failed: [{ key: 'encoding' }, { key: 'facet' }],
  })
  expect(() => d.plotProblems(refused)).toThrow()
  expect(d.plot.encoding).toEqual({ color: 'source' })
  expect(d.facet).toBeUndefined()
})

test('an expression that does not compile is a problem, named by setting', () => {
  const d = display()
  expect(
    d.plotProblems({
      encoding: { color: { value: 'jexl:feature.type ==' } },
      filter: ['jexl:feature.score >'],
    }),
  ).toEqual([
    expect.stringMatching(/^encoding\.color\.value: /),
    expect.stringMatching(/^filter: /),
  ])
  expect(
    d.plotProblems({ encoding: { color: 'jexl:feature.type ==' } }),
  ).toEqual([expect.stringMatching(/^encoding\.color: /)])
  expect(
    d.plotProblems({
      encoding: { color: 'jexl:feature.type' },
      filter: ['jexl:feature.score > 5'],
    }),
  ).toEqual([])
})

test('an applied draft says in the corner what Edit plot said of it', () => {
  const d = display()
  const draft = {
    encoding: {
      color: {
        field: 'score',
        scale: { type: 'linear', domainMin: 10, domainMax: 0 },
      },
    },
    filter: ['jexl:feature.score >'],
  }
  const said = d.plotProblems(draft)
  expect(said).toEqual([
    expect.stringMatching(/^encoding\.color\.scale\.domainMax: /),
    expect.stringMatching(/^filter: /),
  ])
  d.applyPlot(draft)
  expect(d.notices).toEqual(said)
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
      encoding: {
        color: { field: 'biotype', scale: { range: ['red', 'blue'] } },
      },
    })
    d.applyGroupBy('biotype', true)
    expect(d.plot.encoding).toEqual({
      color: { field: 'biotype', scale: { range: ['red', 'blue'] } },
    })
  })

  it('brings back the order and range Solid color parked', () => {
    const d = display()
    d.applyPlot({
      encoding: {
        color: {
          field: 'biotype',
          scale: { domain: ['lncRNA'], range: ['red'] },
        },
      },
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
      d.applyPlot({ facet: { field: 'biotype', sort: ['b'] } })
    }
    viaDialog.applyGroupBy('biotype', true)
    viaText.applyPlot({ encoding: { color: 'biotype' } })
    expect(viaDialog.plot).toEqual(viaText.plot)
    expect(viaText.plot.encoding).toEqual({ color: 'biotype' })
  })

  it("parks a color that was the grouping's own when unticked, and leaves any other", () => {
    const d = display()
    d.applyGroupBy('strand', true)
    expect(d.groupByPlot(undefined, false)).toEqual({
      facet: null,
      encoding: { color: {} },
    })
    d.applyDisplaySettings({ encoding: { color: { value: 'purple' } } })
    expect(d.groupByPlot(undefined, false)).toEqual({ facet: null })
  })

  it('keeps a solid color beside the group color on Apply and on Edit plot alike', () => {
    const viaDialog = display()
    const viaText = display()
    for (const d of [viaDialog, viaText]) {
      d.setColorValue('purple')
      d.applyGroupBy('biotype', true)
      expect(d.plot.encoding).toEqual({
        color: { value: 'purple', field: 'biotype' },
      })
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
      encoding: {
        color: { field: 'dif', scale: { type: 'threshold', domain: ['0'] } },
      },
    })
    expect(d.groupByPlot('dif', true)).toEqual({
      facet: { field: 'dif' },
    })
    expect(d.groupByPlot('strand', false)).toEqual({
      facet: { field: 'strand' },
    })
  })
})

// The plot is the config as written, so the parked field stays out of it.
test('Solid color parks the field, its order and range for the way back', () => {
  const d = display()
  d.applyPlot({
    encoding: {
      color: {
        field: 'biotype',
        scale: { domain: ['lncRNA'], range: ['red'] },
      },
    },
  })
  d.setColorValue('purple')
  expect(d.colorByMode).toBe('solid')
  expect(d.categoricalColorField).toBeUndefined()
  expect(d.plot.encoding).toEqual({ color: { value: 'purple' } })
  expect(d.parkedColor).toMatchObject({ field: 'biotype' })
  expect(d.colorByAttribute).toBe('biotype')
  d.colorByField('biotype')
  expect(d.colorByMode).toBe('attribute')
  expect(d.categoricalColorField?.domain).toEqual(['lncRNA'])
  expect(d.categoricalColorField?.color('lncRNA')).toBe('red')
  d.setColorValue(undefined)
  expect(d.colorByMode).toBe('default')
  expect(d.colorSetting.field).toBe('')
  expect(d.groupByPlot(undefined, false)).toEqual({ facet: null })
})

// Every color tier keys on the channel's arrays, so a write of the color
// already painting would re-bake for nothing.
test('a pick of what already paints writes nothing', () => {
  const d = display()
  d.applyPlot({
    encoding: { color: { field: 'biotype', scale: { range: ['red'] } } },
  })
  const solid = display()
  solid.setColorValue('purple')
  const patches: unknown[] = []
  onPatch(d.configuration, patch => patches.push(patch))
  onPatch(solid.configuration, patch => patches.push(patch))
  d.colorByField('biotype')
  solid.setColorValue('purple')
  expect(patches).toEqual([])
})
