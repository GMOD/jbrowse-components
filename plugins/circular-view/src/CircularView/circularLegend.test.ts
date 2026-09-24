import { types } from '@jbrowse/mobx-state-tree'

import { circularLegendSpec } from './circularLegend.ts'

import type { CircularLegendSource } from './circularLegend.ts'

function viewWith(tracks: { name: string; display: CircularLegendSource }[]) {
  const View = types.model('View', {}).volatile(() => ({
    tracks: tracks.map(({ name, display }) => ({
      configuration: { name, trackId: name, type: 'FeatureTrack' },
      displays: [display],
    })),
  }))
  const Session = types.model('Session', { view: View }).volatile(() => ({
    rpcManager: {},
    configuration: {},
    assemblies: [],
  }))
  return Session.create({ view: {} }).view as unknown as Parameters<
    typeof circularLegendSpec
  >[0]
}

test('a row per track, named by the track, in the color it paints', () => {
  const spec = circularLegendSpec(
    viewWith([
      { name: '<i>coverage</i>', display: { legendColor: '#1565c0' } },
      { name: 'translocations', display: { legendColor: '#ff8500' } },
    ]),
  )
  expect(spec.sections).toEqual([
    {
      id: 'tracks',
      items: [
        { label: 'coverage', color: '#1565c0' },
        { label: 'translocations', color: '#ff8500' },
      ],
    },
  ])
})

test('a density ring shows its ramp under the track name', () => {
  const gradient = { stops: [], minLabel: '0', maxLabel: '12' }
  const spec = circularLegendSpec(
    viewWith([
      {
        name: 'gene density',
        display: {
          legendColor: '#1565c0',
          legendSpec: {
            sections: [{ id: 'score', items: [{ label: '', gradient }] }],
          },
        },
      },
    ]),
  )
  expect(spec.sections[0]?.items).toEqual([{ label: 'gene density', gradient }])
})

test('a track with no single color, such as a jexl stroke, is left out', () => {
  const spec = circularLegendSpec(viewWith([{ name: 'svs', display: {} }]))
  expect(spec.sections).toEqual([])
})
