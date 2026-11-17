import { createTestSession } from '@jbrowse/web/testUtils'
import { render } from '@testing-library/react'

import { useTrackTable } from './useTrackTable.ts'

import type { HierarchicalTrackSelectorModel } from '../HierarchicalTrackSelectorWidget/model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function setup() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'firstId', start: 0, end: 10, seq: 'c' },
        ],
      },
    },
  })
  const tracks = [
    { trackId: 'genes', type: 'FeatureTrack' },
    {
      trackId: 'clinvar',
      type: 'FeatureTrack',
      metadata: { kind: 'Variants' },
    },
    { trackId: 'signal', type: 'QuantitativeTrack' },
  ]
  for (const { trackId, type, metadata } of tracks) {
    session.addSessionTrackConf({
      trackId,
      name: trackId,
      type,
      metadata,
      assemblyNames: ['volMyt1'],
      adapter: { type: 'FromConfigAdapter', features: [] },
    })
  }
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volMyt1', refName: 'ctgA', start: 0, end: 1000 },
    ],
  })
  return view.activateTrackSelector() as HierarchicalTrackSelectorModel
}

test('the kind column reads metadata.kind, else the track type without "track", and metadata.kind gets no column of its own', () => {
  const model = setup()
  let table: ReturnType<typeof useTrackTable> | undefined
  function Probe() {
    table = useTrackTable(model, () => model.allTrackConfigurations)
    return null
  }
  render(<Probe />)

  const kinds = Object.fromEntries(table!.allRows.map(r => [r.id, r.kind]))
  expect(kinds).toMatchObject({
    genes: 'Feature',
    clinvar: 'Variants',
    signal: 'Quantitative',
  })
  expect(table!.metadataKeys).not.toContain('kind')
})
