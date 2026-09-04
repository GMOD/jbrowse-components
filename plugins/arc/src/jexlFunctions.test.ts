import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'

import { addArcJexlFunctions } from './index.ts'

const pluginManager = new PluginManager([])
addArcJexlFunctions(pluginManager)

function logThickness(data: Record<string, unknown>) {
  const feature = new SimpleFeature({
    uniqueId: 'f1',
    refName: 'ctgA',
    start: 100,
    end: 200,
    ...data,
  })
  return pluginManager.jexl
    .compile(String.raw`logThickness(feature,'score')`)
    .eval({ feature })
}

test('logThickness is the log of the attribute plus one', () => {
  expect(logThickness({ score: 10 })).toBe(Math.log(11))
})

// The arc display's `thickness` slot defaults to this, so a BED3/BED4 track
// evaluates it on features carrying no score at all. `Math.log(undefined + 1)`
// is NaN, and a NaN thickness folds into the arc's extent and culls every arc
// off screen with nothing said.
test.each([
  ['no score at all', {}],
  ['a non-numeric score', { score: 'high' }],
  ['a score no log is defined over', { score: -5 }],
])('logThickness answers a number given %s', (_name, data) => {
  expect(logThickness(data)).toBe(0)
})
