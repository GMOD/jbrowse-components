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
// off screen with nothing said. Every one of these has to answer a width the
// display paints, because `layOutArcs` hides an arc whose thickness is 0 — the
// answer to a user's own `jexl:...>5?3:0`, and never to the shipped default.
// `-0.5` is the case `Number.isFinite` let through: `log(0.5)` is -0.693.
test.each([
  ['no score at all', {}],
  ['a non-numeric score', { score: 'high' }],
  ['a score no log is defined over', { score: -5 }],
  ['a score whose log is negative', { score: -0.5 }],
  ['a score of zero', { score: 0 }],
])('logThickness answers a paintable width given %s', (_name, data) => {
  expect(logThickness(data)).toBe(1)
})
