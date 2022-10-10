import SimpleFeature from '../util/simpleFeature'
import { ConfigurationSchema, readConfObject } from '../configuration'
import { openLocation } from '../util/io'
import { BaseAdapter } from './BaseAdapter'

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

class CytobandAdapter extends BaseAdapter {
  async getData() {
    const loc = readConfObject(this.config, 'cytobandLocation')
    if (loc.uri === '' || loc.uri === '/path/to/cytoband.txt.gz') {
      return []
    }
    const data = await openLocation(loc).readFile('utf8')
    return data
      .split(/\n|\r\n|\r/)
      .filter(f => !!f.trim())
      .map(line => {
        const [refName, start, end, name, type] = line.split('\t')
        return new SimpleFeature({
          uniqueId: line,
          refName,
          start: +start,
          end: +end,
          name,
          type,
        })
      })
  }

  freeResources(/* { region } */): void {}
}

export { configSchema, CytobandAdapter as DataAdapter }
