import { ConfigurationSchema } from '../../configuration/index.ts'
import { ObservableCreate } from '../../util/rxjs.ts'
import SimpleFeature from '../../util/simpleFeature.ts'
import { BaseFeatureDataAdapter } from './BaseFeatureDataAdapter.ts'
import { densityAdapterConfigSchemaFields } from './featureDensity.ts'

import type { Feature } from '../../util/simpleFeature.ts'
import type { Region } from '../../util/types/index.ts'
import type { BaseOptions } from './types.ts'

const schema = ConfigurationSchema('DensityTestAdapter', {
  ...densityAdapterConfigSchemaFields,
})

class Sidecar extends BaseFeatureDataAdapter {
  seen: BaseOptions[] = []
  async getRefNames() {
    return ['ctgA']
  }
  getFeatures(region: Region, opts: BaseOptions) {
    this.seen.push(opts)
    return ObservableCreate<Feature>(observer => {
      observer.next(
        new SimpleFeature({
          uniqueId: 'a',
          refName: region.refName,
          start: 0,
          end: 500,
          score: 7,
        }),
      )
      observer.next(
        new SimpleFeature({
          uniqueId: 'b',
          refName: region.refName,
          start: 500,
          end: 1000,
        }),
      )
      observer.complete()
    })
  }
  freeResources() {}
}

class Main extends BaseFeatureDataAdapter {
  async getRefNames() {
    return ['ctgA']
  }
  getFeatures() {
    return ObservableCreate<Feature>(observer => {
      observer.complete()
    })
  }
  freeResources() {}
}

const region = { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }

test('reads the sidecar at the view bp/px and marks the bins exact', async () => {
  const sidecar = new Sidecar(schema.create({}))
  const main = new Main(
    schema.create({ densityAdapter: { type: 'BigWigAdapter' } }),
    async () => ({ dataAdapter: sidecar, sessionIds: new Set<string>() }),
  )
  const density = await main.getFeatureDensity([region], { bpPerPx: 20 })
  expect(density).toHaveLength(1)
  expect(density?.[0]).toEqual({
    starts: new Uint32Array([0, 500]),
    ends: new Uint32Array([500, 1000]),
    scores: new Float32Array([7, 0]),
    exact: true,
  })
  expect(sidecar.seen[0]?.bpPerPx).toBe(20)
})

test('no sidecar means no density', async () => {
  const main = new Main(schema.create({}), async () => {
    throw new Error('should not resolve a sub-adapter')
  })
  await expect(
    main.getFeatureDensity([region], { bpPerPx: 20 }),
  ).resolves.toBeUndefined()
})
