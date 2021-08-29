import { ObservableCreate } from '../util/rxjs'
import { BaseFeatureDataAdapter, BaseOptions } from './BaseAdapter'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { readConfObject } from '@jbrowse/core/configuration'
import { openLocation } from '@jbrowse/core/util/io'

const configSchema = ConfigurationSchema(
  'CytobandAdapter',
  {
    cytobandLocation: {
      type: 'fileLocation',
      defaultValue: { uri: '/path/to/cytoband.txt.gz' },
    },
  },
  { explicitlyTyped: true },
)

class CytobandAdapter extends BaseFeatureDataAdapter {
  async getRefNames(opts?: BaseOptions) {
    return []
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions,
  ) {
    const loc = readConfObject(this.config, 'cytobandLocation')
    const { refName, start, end, originalRefName } = region
    const { signal } = opts || {}
    return ObservableCreate<Feature>(async observer => {
      const data = (await openLocation(loc).readFile('utf8')) as string
      const feats = data
        .split('\n')
        .filter(f => !!f.trim())
        .map(line => {
          const [refName, start, end, name, type] = line.split('\t')
          return { refName, start: +start, end: +end, name, type }
        })
      console.log({ feats })
      observer.complete()
    }, signal)
  }

  freeResources(/* { region } */): void {}
}

export { configSchema, CytobandAdapter as DataAdapter }
