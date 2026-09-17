import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseChannelSpec } from '@jbrowse/display-kit/channelSpec'

import {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from '../RenderFeatureDataRPC/featureColors.ts'
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

test('facet, color and filter land on the slots the menus write', () => {
  const d = display()
  d.applyChannelSpec({
    facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
    color: { field: 'subtrack' },
    filter: ["feature.type == 'gene'"],
  })
  expect(d.groupBy).toEqual({
    type: 'attribute',
    attribute: 'subtrack',
    domain: ['key5', 'key2', 'key3'],
  })
  expect(d.conf.color).toBe(attributeColorJexl('subtrack'))
  expect(d.colorByAttribute).toBe('subtrack')
  expect(d.activeFilters()).toEqual(["jexl:feature.type == 'gene'"])
  expect(d.channelSpec).toEqual({
    facet: { field: 'subtrack', domain: ['key5', 'key2', 'key3'] },
    color: { field: 'subtrack' },
    filter: ["feature.type == 'gene'"],
  })
})

test('strand is a field on both channels', () => {
  const d = display()
  d.applyChannelSpec({ facet: { field: 'strand' }, color: { field: 'strand' } })
  expect(d.groupBy).toMatchObject({ type: 'strand' })
  expect(d.conf.color).toBe(STRAND_COLOR_JEXL)
  expect(d.channelSpec).toMatchObject({
    facet: { field: 'strand' },
    color: { field: 'strand' },
  })
})

test('a string color is a constant, not a field', () => {
  const d = display()
  d.applyChannelSpec({ color: 'red' })
  expect(d.conf.color).toBe('red')
  expect(d.colorByMode).toBe('solid')
  expect(d.channelSpec.color).toBe('red')
})

test("strand's colors are fixed, so a domain or palette on it is a problem", () => {
  expect(
    display().channelSpecProblems({
      color: { field: 'strand', domain: ['1', '-1'] },
    }),
  ).toEqual([expect.stringMatching(/strand's colors are fixed/)])
})

test('a channel the spec leaves out is left alone, and null clears one', () => {
  const d = display()
  d.applyChannelSpec({ facet: { field: 'strand' }, color: 'purple' })
  d.applyChannelSpec({ color: null })
  expect(d.groupBy).toMatchObject({ type: 'strand' })
  expect(d.conf.color).toBeUndefined()
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
    d.channelSpecProblems({
      color: 'red',
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
