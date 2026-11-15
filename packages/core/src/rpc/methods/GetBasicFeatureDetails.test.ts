import PluginManager from '../../PluginManager.ts'
import { ConfigurationSchema } from '../../configuration/configurationSchema.ts'
import { BaseFeatureDataAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import AdapterType from '../../pluggableElementTypes/AdapterType.ts'
import { originTailId } from '../../util/originCut.ts'
import { ObservableCreate } from '../../util/rxjs.ts'
import SimpleFeature from '../../util/simpleFeature.ts'
import GetBasicFeatureDetails from './GetBasicFeatureDetails.ts'

import type { BaseOptions } from '../../data_adapters/BaseAdapter/index.ts'
import type { Feature } from '../../util/simpleFeature.ts'

function call(id: string, start: number, end: number) {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'chr1',
    start,
    end,
    samples: { S1: { GT: ['0/1'] } },
  })
}

const overlapping = [
  call('del', 0, 5_000_000),
  call('dup', 50, 2_000_000),
  call('snv', 99, 100),
]

// read whole, the gene crossing the origin comes back under its own id; cut,
// the piece at the start of the sequence carries the tail id
function originPieces(opts: BaseOptions) {
  return opts.wholeAcrossOrigin
    ? [call('gene', 16_000, 16_700)]
    : [call(originTailId('gene'), 0, 131)]
}

class CallsAdapter extends BaseFeatureDataAdapter {
  async getRefNames() {
    return ['chr1', 'chrM']
  }

  getFeatures(region: { refName: string }, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(observer => {
      for (const feature of region.refName === 'chrM'
        ? originPieces(opts)
        : overlapping) {
        observer.next(feature)
      }
      observer.complete()
    })
  }
}

const pluginManager = new PluginManager()
pluginManager.addAdapterType(
  () =>
    new AdapterType({
      name: 'CallsAdapter',
      configSchema: ConfigurationSchema(
        'CallsAdapter',
        {},
        { explicitlyTyped: true },
      ),
      getAdapterClass: () => Promise.resolve(CallsAdapter),
    }),
)
pluginManager.createPluggableElements()
pluginManager.configure()

function details(featureId: string, refName: string) {
  return new GetBasicFeatureDetails(pluginManager).execute({
    sessionId: 'test',
    adapterConfig: { type: 'CallsAdapter' },
    featureId,
    region: { assemblyName: 'hg38', refName, start: 99, end: 100 },
  })
}

test('answers the clicked record alone where several overlap its base', async () => {
  expect(await details('dup', 'chr1')).toEqual({
    feature: overlapping[1]!.toJSON(),
  })
})

test('a piece past a circular origin answers the whole feature it was cut from', async () => {
  const { feature } = await details(originTailId('gene'), 'chrM')
  expect(feature).toMatchObject({
    uniqueId: 'gene',
    start: 16_000,
    end: 16_700,
  })
})

test('answers nothing where the adapter holds no record with the id', async () => {
  expect(await details('ins', 'chr1')).toEqual({ feature: undefined })
})
