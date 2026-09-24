import path from 'node:path'

import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { waitFor } from '@testing-library/react'

import { createTestSessionAsync } from '../rootModel/test_util.ts'

jest.mock('../makeWorkerInstance', () => () => {})

const gff = path.join(__dirname, '../../test_data/volvox/volvox.sort.gff3.gz')

// The pool gives each id its own worker, so a warm-up sent under any id but the
// one the track's requests use boots and warms a worker the track never asks.
// A config.json track is frozen, and its raw adapter snapshot hashes to another
// id than the one its config node reads.
test('a pending track loads its adapter code under the id its requests use', async () => {
  const call = jest.spyOn(RpcManager.prototype, 'call')
  await createTestSessionAsync({
    jbrowseConfig: {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'FromConfigSequenceAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'ctgA',
                  start: 0,
                  end: 100,
                  seq: 'A'.repeat(100),
                },
              ],
            },
          },
        },
      ],
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'genes',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: { localPath: gff },
            index: { location: { localPath: `${gff}.tbi` } },
          },
        },
      ],
    },
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-50',
          tracks: ['genes'],
        },
      ],
    },
  })
  const idOf = (method: string) =>
    call.mock.calls.find(([, m]) => m === method)?.[0]
  await waitFor(() => {
    expect(idOf('RenderFeatureData')).toBeDefined()
  })
  await Promise.allSettled(call.mock.results.map(r => r.value))
  expect(call.mock.calls[0]).toEqual([
    idOf('RenderFeatureData'),
    'CoreLoadAdapterCode',
    { adapterTypes: ['Gff3TabixAdapter'] },
  ])
})
