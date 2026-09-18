import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getConf } from '@jbrowse/core/configuration'
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

test('facet and color are the two settings, read back as the dialog shows them', () => {
  const d = display()
  expect(
    d.applyDisplaySettings({
      facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
      color: { field: 'subtrack', palette: ['red'] },
    }),
  ).toMatchObject({ applied: ['facet', 'color'], failed: [] })
  d.setJexlFilters(["jexl:feature.type == 'gene'"])
  expect(d.facet).toEqual({
    field: 'subtrack',
    domain: ['key5', 'key2', 'key3'],
  })
  expect(d.colorSettings).toEqual({
    value: undefined,
    field: 'subtrack',
    domain: [],
    palette: ['red'],
  })
  expect(d.colorByAttribute).toBe('subtrack')
  expect(d.channelSpec).toEqual({
    facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
    color: { field: 'subtrack', palette: ['red'] },
    filter: ["feature.type == 'gene'"],
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
  expect(d.colorSettings).toMatchObject({ value: 'red', field: '' })
  expect(d.colorByMode).toBe('solid')
  expect(d.channelSpec.color).toBe('red')
})

test('strand is a field on both channels, painting its own colors', () => {
  const d = display()
  d.applyDisplaySettings({ facet: 'strand', color: { field: 'strand' } })
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
  d.applyDisplaySettings(spec)
  expect(d.colorEncoding?.domain).toEqual(['1', '-1', '0'])
  expect(d.colorEncoding?.color('1')).toBe('red')
  expect(d.colorEncoding?.color('-1')).toBe('blue')
})

test('an object replaces the channel whole, and null clears it', () => {
  const d = display()
  d.applyDisplaySettings({ color: { field: 'source', palette: ['red'] } })
  d.applyDisplaySettings({ color: 'red' })
  expect(d.colorSettings).toEqual({
    value: 'red',
    field: '',
    domain: [],
    palette: [],
  })
  d.applyDisplaySettings({ facet: 'strand', color: { field: 'type' } })
  d.applyDisplaySettings({ color: null })
  expect(d.facet).toMatchObject({ field: 'strand' })
  expect(d.colorSettings).toMatchObject({ value: undefined, field: '' })
  expect(d.channelSpec.color).toBeNull()
  d.applyDisplaySettings({ facet: { field: 'biotype', domain: ['b', 'a'] } })
  d.applyDisplaySettings({ facet: { field: 'biotype' } })
  expect(d.channelSpec.facet).toEqual({ field: 'biotype' })
})

test('a domain or palette that is not a list is refused, and the display keeps what it had', () => {
  const d = display()
  d.applyDisplaySettings({ color: { field: 'source' } })
  expect(
    d.applyDisplaySettings({
      color: { field: 'source', palette: 'red' },
      facet: { field: 'source', domain: 'a' },
    }),
  ).toMatchObject({
    applied: [],
    failed: [{ key: 'color' }, { key: 'facet' }],
  })
  expect(d.channelSpec.color).toEqual({ field: 'source' })
  expect(d.facet).toBeUndefined()
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
    const { filter, ...settings } = parseChannelSpec(spec)
    expect(d.channelSpecProblems({ filter, ...settings })).toEqual([])
    if (Object.keys(settings).length) {
      expect(d.applyDisplaySettings(settings).failed).toEqual([])
    }
    expect(d.channelSpec).toMatchObject(settings)
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
    d.applyDisplaySettings({
      facet: 'biotype',
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
    viaJson.applyDisplaySettings({ color: { field: 'biotype' } })
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
    d.applyDisplaySettings({ color: 'purple' })
    expect(d.groupByChannelSpec(undefined, false)).toEqual({ facet: null })
  })
})
