import {
  STRAND_COLOR_JEXL,
  attributeColorJexl,
} from '../RenderFeatureDataRPC/featureColors.ts'
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

test('a channel the spec leaves out is left alone, and null clears one', () => {
  const d = display()
  d.applyChannelSpec({ facet: { field: 'strand' }, color: { value: 'purple' } })
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
      color: { value: 'jexl:feature.type ==' },
      filter: ['feature.score >'],
    }),
  ).toEqual([
    expect.stringMatching(/^color: /),
    expect.stringMatching(/^filter: /),
  ])
  expect(
    d.channelSpecProblems({
      color: { value: 'red' },
      filter: ['feature.score > 5'],
    }),
  ).toEqual([])
})
