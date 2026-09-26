import PluginManager from '@jbrowse/core/PluginManager'
import { readConfObject } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin from '@jbrowse/plugin-linear-genome-view'

import CanvasPlugin from '../index.ts'

// This display's whole migration is its config schema's `preProcessSnapshot`,
// with no second registration on the DisplayType. A track holds its displays in
// `types.array(pluginManager.pluggableConfigSchemaType('display'))`, a bare
// union with no dispatcher, and the pair below is what says a member's
// preprocessor runs while the union works out which display an entry is: a
// legacy value the preprocessor rewrites loads, and one nothing rewrites is
// still refused by the slot's enumeration.
function pluginManager() {
  const pm = new PluginManager([
    new LinearGenomeViewPlugin(),
    new CanvasPlugin(),
  ])
  pm.createPluggableElements()
  pm.configure()
  return pm
}

const base = { type: 'LinearBasicDisplay', displayId: 'd' }

test('a retired value in a constrained slot survives the display union', () => {
  const displays = types.array(
    pluginManager().pluggableConfigSchemaType('display'),
  )
  expect(() =>
    displays.create([{ ...base, displayMode: 'reducedRepresentation' }]),
  ).not.toThrow()
  expect(() => displays.create([{ ...base, displayMode: 'notAMode' }])).toThrow(
    /displayMode/,
  )
})

test('a retired colour key becomes the slot that replaced it', () => {
  const conf = pluginManager()
    .getDisplayType('LinearBasicDisplay')
    .configSchema.create({ ...base, color1: 'red' })
  expect(readConfObject(conf, ['color', 'value'])).toBe('red')
})
