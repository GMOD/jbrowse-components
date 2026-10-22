import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import { connectionFilterOf, mergeFilter } from '../shared/alignmentsFilter.ts'
import configSchemaFactory from './configSchema.ts'

function create(snapshot: Record<string, unknown>) {
  return configSchemaFactory(new PluginManager()).create({
    type: 'LinearAlignmentsDisplay',
    displayId: 'd',
    ...snapshot,
  })
}

const connectionsOf = (conf: ReturnType<typeof create>) =>
  connectionFilterOf(mergeFilter(predicatesOf(conf.filter)))

// v4.3.0's LinearReadArcsDisplay wrote these two under the draw verb, so a
// released config can carry them
test('the v4 draw verbs lift onto the connection filter', () => {
  const conf = create({ drawInter: false, drawLongRange: false })
  expect(connectionsOf(conf)).toMatchObject({
    interchrom: 'exclude',
    offscreenMates: 'exclude',
  })
  expect(connectionsOf(create({ drawInter: true })).interchrom).toBeUndefined()
})

test('the current spelling beside a retired one wins', () => {
  const conf = create({
    drawInter: false,
    filter: [{ field: 'connection.interchrom', equal: true }],
  })
  expect(connectionsOf(conf).interchrom).toBe('only')
})

// v4.3.0's pileup display wrote its read filter as `filterBy`; the two read
// arcs verbs beside it land in the same list
test('a v4 filterBy and draw verb lift together, under the list written', () => {
  const conf = create({
    filterBy: {
      flagInclude: 0,
      flagExclude: 1540 | 256,
      tagFilter: { tag: 'HP', value: '1' },
    },
    drawInter: false,
    filter: [{ field: 'tags.HP', equal: '2' }],
  })
  expect(predicatesOf(conf.filter)).toEqual([
    { field: 'flags.SECONDARY', equal: false },
    { field: 'tags.HP', equal: '2' },
    { field: 'connection.interchrom', equal: false },
  ])
})

test('mismatchAlpha lifts onto pileup.fadeLowBaseQuality, top level and renderer', () => {
  expect(
    readConfObject(create({ mismatchAlpha: true }), [
      'pileup',
      'fadeLowBaseQuality',
    ]),
  ).toBe(true)
  expect(
    readConfObject(
      create({ renderers: { PileupRenderer: { mismatchAlpha: true } } }),
      ['pileup', 'fadeLowBaseQuality'],
    ),
  ).toBe(true)
})

// v4.3.0's read cloud display declared `featureHeight` and its pileup renderer
// `maxHeight`; both are the pileup band's now
test('a v4 read size and layout cap lift into pileup', () => {
  const conf = create({ featureHeight: 3, maxHeight: 900 })
  expect(readConfObject(conf, ['pileup', 'readHeight'])).toBe(3)
  expect(readConfObject(conf, ['pileup', 'maxLayoutHeight'])).toBe(900)
})

test("a display's own v4 read size beats its renderer's", () => {
  const conf = create({
    featureHeight: 3,
    renderers: { PileupRenderer: { height: 9, maxHeight: 900 } },
  })
  expect(readConfObject(conf, ['pileup', 'readHeight'])).toBe(3)
  expect(readConfObject(conf, ['pileup', 'maxLayoutHeight'])).toBe(900)
})

// The reads' `color` reads a bare string as a constant, so the arcs' color
// refuses one rather than read it as a field
test('readConnections.color takes { field }, never a bare string', () => {
  expect(() => create({ readConnections: { color: 'insertSize' } })).toThrow(
    'readConnections.color takes { "field": "insertSize" }',
  )
  expect(
    readConfObject(
      create({ readConnections: { color: { field: 'insertSize' } } }),
      ['readConnections', 'color', 'field'],
    ),
  ).toBe('insertSize')
})
