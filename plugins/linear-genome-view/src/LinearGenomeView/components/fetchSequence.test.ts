import { SimpleFeature } from '@jbrowse/core/util'

import { fetchSequence } from './fetchSequence.ts'

import type { Region } from '@jbrowse/core/util/types'

jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getSession: (node: { session: unknown }) => node.session,
}))
jest.mock('@jbrowse/core/assemblyManager/assembly', () => ({
  getSequenceAdapterConfig: () => ({ type: 'FakeSequenceAdapter' }),
}))

const sequenceOf: Record<string, string> = { chr1: 'AAAA', chr2: 'CC' }
const delayOf: Record<string, number> = { chr1: 30, chr2: 0 }

function modelWithSequence() {
  const call = jest.fn(
    async (
      _id: string,
      _method: string,
      { regions }: { regions: Region[] },
    ) => {
      const { refName, start, end } = regions[0]!
      await new Promise(resolve => setTimeout(resolve, delayOf[refName]))
      const seq = sequenceOf[refName]
      return seq === undefined
        ? []
        : [new SimpleFeature({ uniqueId: refName, refName, start, end, seq })]
    },
  )
  return {
    session: {
      rpcManager: { call },
      assemblyManager: { get: () => ({}) },
    },
  }
}

const region = (refName: string, end: number) => ({
  assemblyName: 'hg',
  refName,
  start: 0,
  end,
})

test('returns one sequence per region, in selection order, when the later region answers first', async () => {
  const chunks = await fetchSequence(modelWithSequence(), [
    region('chr1', 4),
    region('chr2', 2),
  ])
  expect(chunks.map(c => c.get('seq'))).toEqual(['AAAA', 'CC'])
})

test('a region the sequence lacks is an error, not a silently shorter FASTA', async () => {
  await expect(
    fetchSequence(modelWithSequence(), [region('chr1', 4), region('chrUn', 5)]),
  ).rejects.toThrow(/no sequence found for {hg}chrUn:1\.\.5/)
})
