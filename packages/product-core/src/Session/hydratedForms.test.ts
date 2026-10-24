import { ConfigurationSchema } from '@jbrowse/core/configuration'

import { deltaInCurrentSpelling } from './hydratedForms.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const band = ConfigurationSchema(
  'Band',
  { height: { type: 'number', defaultValue: 10 } },
  { retired: { size: (height: unknown) => ({ height }) } },
)

const display = ConfigurationSchema(
  'BandDisplay',
  { band, opacity: { type: 'number', defaultValue: 1 } },
  {
    explicitlyTyped: true,
    explicitIdentifier: 'displayId',
    retired: { alpha: (opacity: unknown) => ({ opacity }) },
  },
)

const pluginManager = {
  displayTypes: new Map([['BandDisplay', {}]]),
  getDisplayType: () => ({ configSchema: display }),
} as unknown as PluginManager

const respell = deltaInCurrentSpelling(pluginManager)

const base = {
  trackId: 't',
  displays: [{ type: 'BandDisplay', displayId: 't-BandDisplay' }],
}

test('a delta display lifts by the type of the base display it lands on', () => {
  expect(
    respell(base, {
      trackId: 't',
      displays: [
        { displayId: 't-BandDisplay', alpha: 0.5, band: { size: null } },
      ],
    }),
  ).toEqual({
    trackId: 't',
    displays: [
      { displayId: 't-BandDisplay', opacity: 0.5, band: { height: null } },
    ],
  })
})

test('a delta in the current spelling comes back by identity', () => {
  const delta = {
    trackId: 't',
    displays: [{ displayId: 't-BandDisplay', band: { height: 3 } }],
  }
  expect(respell(base, delta)).toBe(delta)
})
