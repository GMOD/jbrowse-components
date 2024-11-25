// locals
import { fetchAndMaybeUnzip, SimpleFeature } from '../../util'
import { openLocation } from '../../util/io'
import { BaseAdapter } from '../BaseAdapter'
import type { BaseOptions } from '../BaseAdapter/BaseOptions'

export default class CytobandAdapter extends BaseAdapter {
  async getData(opts?: BaseOptions) {
    const conf = this.getConf('cytobandLocation')
    if (conf.uri === '' || conf.uri === '/path/to/cytoband.txt.gz') {
      return []
    }

    const pm = this.pluginManager
    const buf = await fetchAndMaybeUnzip(openLocation(conf, pm), opts)
    const decoder = new TextDecoder('utf8', { fatal: true })
    const text = decoder.decode(buf)
    return text
      .split(/\n|\r\n|\r/)
      .filter(f => !!f.trim())
      .map((line, i) => {
        const [refName, start, end, name, type] = line.split('\t')
        return new SimpleFeature({
          uniqueId: `${i}`,
          refName: refName!,
          start: +start!,
          end: +end!,
          name,
          type,
          gieStain: type || name,
        })
      })
  }

  freeResources(/* { region } */): void {}
}
