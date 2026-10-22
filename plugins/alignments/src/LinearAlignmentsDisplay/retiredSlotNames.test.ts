import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'

function create(snapshot: Record<string, unknown>) {
  return configSchemaFactory(new PluginManager()).create({
    type: 'LinearAlignmentsDisplay',
    displayId: 'd',
    ...snapshot,
  })
}

// v4.3.0's LinearReadArcsDisplay wrote these two under the draw verb, so a
// released config can carry them
test('the v4 draw verbs lift onto the connection filter', () => {
  const conf = create({ drawInter: false, drawLongRange: false })
  expect(readConfObject(conf, ['filter', 'connections', 'interchrom'])).toBe(
    'exclude',
  )
  expect(
    readConfObject(conf, ['filter', 'connections', 'offscreenMates']),
  ).toBe('exclude')
  expect(
    readConfObject(create({ drawInter: true }), [
      'filter',
      'connections',
      'interchrom',
    ]),
  ).toBeUndefined()
})

test('the current spelling beside a retired one wins', () => {
  const conf = create({
    drawInter: false,
    filter: { connections: { interchrom: 'only' } },
  })
  expect(readConfObject(conf, ['filter', 'connections', 'interchrom'])).toBe(
    'only',
  )
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

// A bare string inside `encoding` is the field, on the arcs as on the reads
test('readConnections.encoding.color reads a bare string as its field', () => {
  const path = ['readConnections', 'encoding', 'color', 'field'] as const
  expect(
    readConfObject(
      create({ readConnections: { encoding: { color: 'insertSize' } } }),
      path,
    ),
  ).toBe('insertSize')
  expect(
    readConfObject(
      create({
        readConnections: { encoding: { color: { field: 'insertSize' } } },
      }),
      path,
    ),
  ).toBe('insertSize')
})

test('readConnections.encoding.strokeWidth reads a bare number as its value', () => {
  expect(
    readConfObject(
      create({ readConnections: { encoding: { strokeWidth: 2 } } }),
      ['readConnections', 'encoding', 'strokeWidth', 'value'],
    ),
  ).toBe(2)
})
