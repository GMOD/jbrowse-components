import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { flattenTrackConfigDelta, mergeTrackConfig } from '@jbrowse/core/util'

import { displayForms } from './hydratedForms.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const band = ConfigurationSchema(
  'Band',
  { height: { type: 'number', defaultValue: 10 } },
  { retired: { size: (height: unknown) => ({ height }) } },
)

const mark = ConfigurationSchema(
  'BandMark',
  {
    type: { type: 'string', defaultValue: 'bar' },
    extent: { type: 'string', defaultValue: 'min-max' },
  },
  { shorthand: 'type', writes: 'members' },
)

const display = ConfigurationSchema(
  'BandDisplay',
  { band, mark, opacity: { type: 'number', defaultValue: 1 } },
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

const forms = displayForms(pluginManager)

const base = {
  trackId: 't',
  displays: [
    {
      type: 'BandDisplay',
      displayId: 't-BandDisplay',
      opacity: 0.8,
      band: { height: 4 },
      mark: { type: 'bar', extent: 'none' },
    },
  ],
}

test('a retired spelling at any depth merges over the current one', () => {
  expect(
    mergeTrackConfig(
      base,
      {
        trackId: 't',
        displays: [
          { displayId: 't-BandDisplay', alpha: 0.5, band: { size: null } },
        ],
      },
      forms,
    ).displays,
  ).toEqual([
    {
      type: 'BandDisplay',
      displayId: 't-BandDisplay',
      opacity: 0.5,
      band: {},
      mark: { type: 'bar', extent: 'none' },
    },
  ])
})

test('a bare name merges into the members the base writes', () => {
  const delta = {
    trackId: 't',
    displays: [{ displayId: 't-BandDisplay', mark: 'line' }],
  }
  expect(mergeTrackConfig(base, delta, forms).displays[0]!.mark).toEqual({
    type: 'line',
    extent: 'none',
  })
  expect(
    flattenTrackConfigDelta(base, delta, forms).map(c => c.path.join('.')),
  ).toEqual(['displays.BandDisplay.mark.type'])
})

test('a display already in canonical spelling comes back by identity', () => {
  const d = { displayId: 't-BandDisplay', mark: { type: 'line' } }
  expect(forms.canonical('BandDisplay', d)).toBe(d)
})

test('a display type no plugin registers keeps its spelling', () => {
  const d = { displayId: 'x', mark: 'line' }
  expect(forms.canonical('Unregistered', d)).toBe(d)
  expect(forms.wholeAt('Unregistered', ['mark'])).toBe(false)
})
