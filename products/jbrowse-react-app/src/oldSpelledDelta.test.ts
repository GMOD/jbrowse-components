import { readConfObject } from '@jbrowse/core/configuration'

import createViewState from './createViewState.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  AnyConfigurationModel,
  TrackConfigEntry,
} from '@jbrowse/core/configuration'

jest.mock('./makeWorkerInstance', () => () => {})

const assemblies = ['volvox', 'other'].map(name => ({
  name,
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: `${name}_refseq`,
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        { refName: 'ctgA', uniqueId: name, start: 0, end: 4, seq: 'acgt' },
      ],
    },
  },
}))

interface Session {
  getTrackById: (trackId: string) => TrackConfigEntry | undefined
  getTrackConfigChanges: (
    trackId: string,
  ) => { path: string[]; from: unknown; to: unknown }[]
}

const wiggle = {
  type: 'QuantitativeTrack',
  adapter: { type: 'BigWigAdapter', uri: 'x.bw' },
  display: 'LinearWiggleDisplay',
  y: ['encoding', 'y'],
}

function load(
  kind: typeof wiggle,
  base: Record<string, unknown>,
  delta: Record<string, unknown>,
) {
  const displayId = `t-${kind.display}`
  const state = createViewState({
    config: {
      assemblies,
      tracks: [
        {
          type: kind.type,
          trackId: 't',
          name: 't',
          assemblyNames: ['volvox'],
          adapter: kind.adapter,
          displays: [{ type: kind.display, displayId, ...base }],
        },
      ],
    },
    session: {
      name: 'old',
      trackConfigDeltas: {
        t: { trackId: 't', displays: [{ displayId, ...delta }] },
      },
    },
  })
  const { pluginManager } = state as unknown as { pluginManager: PluginManager }
  const session = state.session as unknown as Session
  const track = pluginManager
    .pluggableConfigSchemaType('track')
    .create(session.getTrackById('t'), { pluginManager }) as unknown as {
    displays: AnyConfigurationModel[]
  }
  const display = track.displays.find(d => d.displayId === displayId)!
  return {
    session,
    read: (...path: string[]) => readConfObject(display, [...kind.y, ...path]),
  }
}

describe('an old wiggle delta in v4 slot names', () => {
  const base = {
    encoding: {
      y: {
        field: 'maxScore',
        scale: { type: 'log', domainMax: 9 },
        axis: { grid: true },
      },
    },
  }

  test('scaleType and displayCrossHatches win', () => {
    const { read } = load(wiggle, base, {
      scaleType: 'linear',
      displayCrossHatches: false,
    })
    expect(read('scale', 'type')).toBe('linear')
    expect(read('axis', 'grid')).toBe(false)
    expect(read('field')).toBe('maxScore')
  })

  test.each([
    [{ scaleType: null }, ['scale', 'type'], 'linear'],
    [{ maxScore: null }, ['scale', 'domainMax'], undefined],
    [{ displayCrossHatches: null }, ['axis', 'grid'], false],
  ])('%j resets what it lifts onto', (delta, path, expected) => {
    const { read } = load(wiggle, base, delta)
    expect(read(...path)).toBe(expected)
  })

  test('the changes list names the member at its current path', () => {
    const { session } = load(wiggle, base, { maxScore: 50 })
    expect(session.getTrackConfigChanges('t')).toEqual([
      {
        path: ['displays', wiggle.display, ...wiggle.y, 'scale', 'domainMax'],
        from: 9,
        to: 50,
      },
    ])
  })
})
