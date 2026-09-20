import { readConfObject } from '@jbrowse/core/configuration'
import { fetchHub } from '@jbrowse/core/util/fetchHub'

import { createViewState } from './index.ts'

jest.mock('./makeWorkerInstance', () => () => {})
jest.mock('@jbrowse/core/util/fetchHub', () => ({ fetchHub: jest.fn() }))

function hub(name: string) {
  return {
    assemblies: [
      { name, uri: `https://jbrowse.org/genomes/${name}/${name}.2bit` },
    ],
    tracks: [
      {
        type: 'VariantTrack',
        trackId: `${name}_sv`,
        name: `${name} SVs`,
        assemblyNames: [name],
        adapter: {
          type: 'VcfTabixAdapter',
          uri: `https://example.com/${name}.vcf.gz`,
        },
      },
    ],
  }
}

test('jbrowseHub takes a list, and the circle holds each genome and its catalog in that order', async () => {
  jest
    .mocked(fetchHub)
    .mockImplementation((name: string) => Promise.resolve(hub(name)))
  const state = await createViewState({ jbrowseHub: ['volvox', 'volvox2'] })
  expect(jest.mocked(fetchHub).mock.calls.map(c => c[0])).toEqual([
    'volvox',
    'volvox2',
  ])
  expect(state.session.assemblyNames).toEqual(['volvox', 'volvox2'])
  expect(state.session.tracks.map(t => readConfObject(t, 'trackId'))).toEqual([
    'volvox_sv',
    'volvox2_sv',
  ])
})

test('an assembly beside a jbrowseHub is refused', async () => {
  const both = { jbrowseHub: 'volvox', assembly: hub('volvox').assemblies[0]! }
  await expect(
    // @ts-expect-error a hub is a whole genome, so it excludes `assembly`
    createViewState(both),
  ).rejects.toThrow('pass assembly or jbrowseHub, not both')
})
