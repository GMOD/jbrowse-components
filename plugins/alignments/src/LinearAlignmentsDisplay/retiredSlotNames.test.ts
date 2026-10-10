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
test('the v4 draw verbs lift onto the show slots', () => {
  const conf = create({ drawInter: false, drawLongRange: false })
  expect(readConfObject(conf, 'showInterchrom')).toBe(false)
  expect(readConfObject(conf, 'showLongRange')).toBe(false)
})

test('the current spelling beside a retired one wins', () => {
  const conf = create({ drawInter: false, showInterchrom: true })
  expect(readConfObject(conf, 'showInterchrom')).toBe(true)
})

test('mismatchAlpha lifts onto fadeLowQualityMismatches, top level and renderer', () => {
  expect(
    readConfObject(create({ mismatchAlpha: true }), 'fadeLowQualityMismatches'),
  ).toBe(true)
  expect(
    readConfObject(
      create({ renderers: { PileupRenderer: { mismatchAlpha: true } } }),
      'fadeLowQualityMismatches',
    ),
  ).toBe(true)
})
