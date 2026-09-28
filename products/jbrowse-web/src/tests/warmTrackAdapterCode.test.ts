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
test('a pending track loads its adapter code and reads its index under the id its requests use', async () => {
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
  expect(call.mock.calls[1]).toEqual([
    idOf('RenderFeatureData'),
    'CoreGetRefNames',
    expect.objectContaining({ assemblyName: 'volvox' }),
  ])
})

// A star of 241 liftOver files answers the anchor's refNames from every child's
// index unless told which lanes, and only its display knows; the warm-up
// still loads its code
test('a pending track whose source declares its lanes loads its code and reads no index', async () => {
  const call = jest.spyOn(RpcManager.prototype, 'call')
  call.mockClear()
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
          type: 'SyntenyTrack',
          trackId: 'star',
          assemblyNames: ['volvox', 'volvox_random'],
          adapter: {
            type: 'MultiPairwiseSyntenyAdapter',
            adapters: [
              {
                type: 'PAFAdapter',
                pafLocation: { localPath: '/nonexistent/a.paf' },
                assemblyNames: ['volvox_random', 'volvox'],
              },
            ],
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
          tracks: ['star'],
        },
      ],
    },
  })
  const isWarmUp = ([, m, a]: [unknown, string, unknown]) =>
    m === 'CoreLoadAdapterCode' &&
    (a as { adapterTypes: string[] }).adapterTypes.includes(
      'MultiPairwiseSyntenyAdapter',
    )
  await waitFor(() => {
    expect(call.mock.calls.some(c => isWarmUp(c as never))).toBe(true)
  })
  await Promise.allSettled(call.mock.results.map(r => r.value))
  // the warm-up sends its two calls back to back; the display's own fetch
  // renames later, naming its lanes
  const next = call.mock.calls[call.mock.calls.findIndex(c => isWarmUp(c)) + 1]
  expect(next?.[1]).not.toBe('CoreGetRefNames')
})
