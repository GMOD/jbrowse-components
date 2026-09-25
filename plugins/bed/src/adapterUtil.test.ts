import { IntervalTree } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { intervalTreeFeatures } from './adapterUtil.ts'

import type { Feature } from '@jbrowse/core/util'

const query = { assemblyName: 'a', refName: 'chr1', start: 0, end: 10 }

function read(features: ReturnType<typeof intervalTreeFeatures>, opts = {}) {
  return firstValueFrom(features(query, opts).pipe(toArray()))
}

test('each fetch hands its own opts to the load, and the tree is built once', async () => {
  const loadData = jest.fn(async () => {})
  const buildTree = jest.fn(async () => new IntervalTree<Feature>())
  const features = intervalTreeFeatures(loadData, buildTree)
  const first = { statusCallback: () => {} }
  const second = { statusCallback: () => {} }
  await read(features, first)
  await read(features, second)
  expect(loadData.mock.calls).toEqual([[first], [second]])
  expect(buildTree).toHaveBeenCalledTimes(1)
})

test('a tree that failed to build is built again', async () => {
  const buildTree = jest
    .fn<Promise<IntervalTree<Feature> | undefined>, [string]>()
    .mockRejectedValueOnce(new Error('transient'))
    .mockResolvedValue(new IntervalTree<Feature>())
  const features = intervalTreeFeatures(async () => {}, buildTree)
  await expect(read(features)).rejects.toThrow('transient')
  await expect(read(features)).resolves.toEqual([])
  expect(buildTree).toHaveBeenCalledTimes(2)
})
