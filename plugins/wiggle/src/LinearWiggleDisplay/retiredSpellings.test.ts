import PluginManager from '@jbrowse/core/PluginManager'
import { applyConfSettings, readConfObject } from '@jbrowse/core/configuration'
import { preprocessTrackConfigSnapshot } from '@jbrowse/core/pluggableElementTypes/models'

import WigglePlugin from '../index.ts'

// The v5 betas spelt the point diameter `scatterPointSize`, and the display's
// schema declares it retired. Every door into a display setting reads that one
// declaration, which is the whole point of it: the three below disagreed once,
// `scatterPointSize` reaching the slot through a `displays` entry, dropped with
// a console warning through the shorthand, and reported unapplied in a bag.
function pluginManager() {
  const pm = new PluginManager([new WigglePlugin()])
  pm.createPluggableElements()
  pm.configure()
  return pm
}

function wiggleEntry(snap: Record<string, unknown>) {
  const out = preprocessTrackConfigSnapshot(pluginManager(), {
    type: 'QuantitativeTrack',
    trackId: 't',
    name: 't',
    assemblyNames: ['volvox'],
    adapter: { type: 'BigWigAdapter', uri: 'a.bw' },
    ...snap,
  })
  return (out.displays as Record<string, unknown>[]).find(
    d => d.type === 'LinearWiggleDisplay',
  )
}

test('a displays entry', () => {
  expect(
    wiggleEntry({
      displays: [
        {
          type: 'LinearWiggleDisplay',
          displayId: 't-LinearWiggleDisplay',
          scatterPointSize: 9,
        },
      ],
    }),
  ).toMatchObject({ size: 9 })
})

test('the displayDefaults shorthand', () => {
  expect(
    wiggleEntry({ displayDefaults: { scatterPointSize: 9 } }),
  ).toMatchObject({ size: 9 })
})

test('a settings bag, which is what a spec URL and an agent call write', () => {
  const schema = pluginManager().getDisplayType(
    'LinearWiggleDisplay',
  ).configSchema
  const conf = schema.create({ type: 'LinearWiggleDisplay', displayId: 'd' })
  const report = applyConfSettings(conf, { scatterPointSize: 9 })
  expect(report.undeclared).toEqual({})
  expect(readConfObject(conf, 'size')).toBe(9)
})

test('the shorthand still reports a name no display knows', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  wiggleEntry({ displayDefaults: { scatterPointSizze: 9 } })
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('"scatterPointSizze" is not a slot'),
  )
  warn.mockRestore()
})
