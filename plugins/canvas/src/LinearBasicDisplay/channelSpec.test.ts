import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseChannelSpec } from '@jbrowse/display-kit/channelSpec'

import { CHANNEL_SPEC_EXAMPLES } from './channelSpec.ts'
import { createTestEnvironment } from './testEnv.ts'

function display() {
  return createTestEnvironment().createDisplay().display
}

test('an untouched display reads every channel as null', () => {
  expect(display().channelSpec).toEqual({
    facet: null,
    color: null,
    filter: null,
  })
})

test('facet, color and filter land on the settings the menus write', () => {
  const d = display()
  d.applyChannelSpec({
    facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
    color: { field: 'subtrack', palette: ['red'] },
    filter: ["feature.type == 'gene'"],
  })
  expect(d.facet).toEqual({
    field: 'subtrack',
    domain: ['key5', 'key2', 'key3'],
  })
  expect(d.colorSettings).toEqual({
    color: undefined,
    colorField: 'subtrack',
    colorDomain: [],
    colorPalette: ['red'],
  })
  expect(d.colorByAttribute).toBe('subtrack')
  expect(d.activeFilters()).toEqual(["jexl:feature.type == 'gene'"])
  expect(d.channelSpec).toEqual({
    facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
    color: { field: 'subtrack', palette: ['red'] },
    filter: ["feature.type == 'gene'"],
  })
})

test('strand is a field on both channels, painting its own colors', () => {
  const d = display()
  d.applyChannelSpec({ facet: { field: 'strand' }, color: { field: 'strand' } })
  expect(d.facet).toEqual({ field: 'strand', domain: [] })
  expect(d.colorByMode).toBe('strand')
  expect(d.colorEncoding?.color('1')).toBe('tomato')
  expect(d.colorEncoding?.color('-1')).toBe('cornflowerblue')
  expect(d.channelSpec).toMatchObject({
    facet: { field: 'strand' },
    color: { field: 'strand' },
  })
})

test('strand takes a palette like any other field', () => {
  const d = display()
  const spec = { color: { field: 'strand', palette: ['red', 'blue'] } }
  expect(d.channelSpecProblems(spec)).toEqual([])
  d.applyChannelSpec(spec)
  expect(d.colorEncoding?.domain).toEqual(['1', '-1', '0'])
  expect(d.colorEncoding?.color('1')).toBe('red')
  expect(d.colorEncoding?.color('-1')).toBe('blue')
})

test('a string color is a constant, and it and a field scale replace each other', () => {
  const d = display()
  d.applyChannelSpec({ color: { field: 'source' } })
  d.applyChannelSpec({ color: 'red' })
  expect(d.colorSettings).toMatchObject({ color: 'red', colorField: '' })
  expect(d.colorByMode).toBe('solid')
  expect(d.channelSpec.color).toBe('red')
  d.applyChannelSpec({ color: { field: 'source' } })
  expect(d.colorSettings).toMatchObject({
    color: undefined,
    colorField: 'source',
  })
})

test('a channel the spec leaves out is left alone, and null clears one', () => {
  const d = display()
  d.applyChannelSpec({ facet: { field: 'strand' }, color: { field: 'type' } })
  d.applyChannelSpec({ color: null })
  expect(d.facet).toMatchObject({ field: 'strand' })
  expect(d.colorSettings).toMatchObject({ color: undefined, colorField: '' })
  expect(d.channelSpec.color).toBeNull()
})

test('a facet naming no domain sorts, where the menus would carry one', () => {
  const d = display()
  d.applyChannelSpec({ facet: { field: 'biotype', domain: ['b', 'a'] } })
  d.applyChannelSpec({ facet: { field: 'biotype' } })
  expect(d.channelSpec.facet).toEqual({ field: 'biotype' })
})

test('a null filter shows everything rather than returning to the config', () => {
  const d = display()
  d.applyChannelSpec({ filter: ["feature.type == 'gene'"] })
  d.applyChannelSpec({ filter: null })
  expect(d.activeFilters()).toEqual([])
})

test('an expression that does not compile is a problem, named by channel', () => {
  const d = display()
  expect(
    d.channelSpecProblems({
      color: 'jexl:feature.type ==',
      filter: ['feature.score >'],
    }),
  ).toEqual([
    expect.stringMatching(/^color: /),
    expect.stringMatching(/^filter: /),
  ])
  expect(
    d.channelSpecProblems({ color: { field: 'jexl:feature.type ==' } }),
  ).toEqual([expect.stringMatching(/^color: /)])
  expect(
    d.channelSpecProblems({
      color: { field: 'jexl:feature.type' },
      filter: ['feature.score > 5'],
    }),
  ).toEqual([])
})

test.each(CHANNEL_SPEC_EXAMPLES)(
  'the example $spec parses, passes and applies',
  ({ spec }) => {
    const d = display()
    const parsed = parseChannelSpec(spec)
    expect(d.channelSpecProblems(parsed)).toEqual([])
    d.applyChannelSpec(parsed)
    expect(d.channelSpec).toMatchObject(parsed)
  },
)

test('the gene track guide prints every example the dialog lists', () => {
  const guide = readFileSync(
    join(__dirname, '../../../../website/docs/user_guides/gene_track.md'),
    'utf8',
  ).replaceAll(/\n\s*/g, ' ')
  for (const { spec, description } of CHANNEL_SPEC_EXAMPLES) {
    expect(guide).toContain(`\`${spec}\` ${description}`)
  }
})

describe('the Group by dialog applies a channel spec', () => {
  it('keeps the palette of the field already painting', () => {
    const d = display()
    d.applyChannelSpec({
      facet: { field: 'biotype' },
      color: { field: 'biotype', palette: ['red', 'blue'] },
    })
    d.applyGroupBy('biotype', true)
    expect(d.channelSpec.color).toEqual({
      field: 'biotype',
      palette: ['red', 'blue'],
    })
  })

  it('names no color domain from the facet on either route', () => {
    const viaDialog = display()
    const viaJson = display()
    for (const d of [viaDialog, viaJson]) {
      d.setFacet({ field: 'biotype', domain: ['b'] })
    }
    viaDialog.applyGroupBy('biotype', true)
    viaJson.applyChannelSpec({ color: { field: 'biotype' } })
    expect(viaDialog.channelSpec).toEqual(viaJson.channelSpec)
    expect(viaJson.channelSpec.color).toEqual({ field: 'biotype' })
  })

  it("clears a color that was the grouping's own when unticked, and leaves any other", () => {
    const d = display()
    d.applyGroupBy('strand', true)
    expect(d.groupByChannelSpec(undefined, false)).toEqual({
      facet: null,
      color: null,
    })
    d.applyChannelSpec({ color: 'purple' })
    expect(d.groupByChannelSpec(undefined, false)).toEqual({ facet: null })
  })
})
