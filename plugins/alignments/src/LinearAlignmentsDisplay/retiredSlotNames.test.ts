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

test('mismatchAlpha lifts onto the mismatches opacity field, top level and renderer', () => {
  const field = [
    'pileup',
    'mismatches',
    'encoding',
    'opacity',
    'field',
  ] as const
  expect(readConfObject(create({ mismatchAlpha: true }), field)).toBe(
    'baseQuality',
  )
  expect(
    readConfObject(
      create({
        renderers: {
          PileupRenderer: { mismatchAlpha: true, hideMismatches: true },
        },
      }),
      field,
    ),
  ).toBe('baseQuality')
  expect(
    readConfObject(
      create({
        renderers: { PileupRenderer: { mismatchAlpha: true } },
        mismatchAlpha: false,
      }),
      field,
    ),
  ).toBeUndefined()
})

// v4.3.0's read cloud display declared `featureHeight` and its pileup renderer
// `maxHeight`; both are the pileup band's now
test('a v4 read size and layout cap lift into pileup', () => {
  const conf = create({ featureHeight: 3, maxHeight: 900 })
  expect(readConfObject(conf, ['pileup', 'mark', 'height'])).toBe(3)
  expect(readConfObject(conf, ['pileup', 'maxLayoutHeight'])).toBe(900)
})

test("a display's own v4 read size beats its renderer's", () => {
  const conf = create({
    featureHeight: 3,
    renderers: { PileupRenderer: { height: 9, maxHeight: 900 } },
  })
  expect(readConfObject(conf, ['pileup', 'mark', 'height'])).toBe(3)
  expect(readConfObject(conf, ['pileup', 'maxLayoutHeight'])).toBe(900)
})

// A bare string inside `encoding` is the field, on the arcs as on the reads
test('readConnections.encoding.color reads a bare string as its field', () => {
  const path = ['readConnections', 'encoding', 'color', 'field'] as const
  expect(
    readConfObject(
      create({ readConnections: { encoding: { color: 'pairOrientation' } } }),
      path,
    ),
  ).toBe('pairOrientation')
  expect(
    readConfObject(
      create({
        readConnections: { encoding: { color: { field: 'pairOrientation' } } },
      }),
      path,
    ),
  ).toBe('pairOrientation')
})

test('readConnections.encoding.strokeWidth reads a bare number as its value', () => {
  expect(
    readConfObject(
      create({ readConnections: { encoding: { strokeWidth: 2 } } }),
      ['readConnections', 'encoding', 'strokeWidth', 'value'],
    ),
  ).toBe(2)
})
