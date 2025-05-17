import { SimpleFeature, fetchAndMaybeUnzipText } from '../../util'
import { openLocation } from '../../util/io'
import { BaseAdapter } from '../BaseAdapter'

import type { BaseOptions } from '../BaseAdapter/BaseOptions'

export default class CytobandAdapter extends BaseAdapter {
  async getData(opts?: BaseOptions) {
    const conf = this.getConf('cytobandLocation')
    if (conf.uri === '' || conf.uri === '/path/to/cytoband.txt.gz') {
      return []
    }

    const text = await fetchAndMaybeUnzipText(
      openLocation(conf, this.pluginManager),
      opts,
    )
    return text
      .split(/\n|\r\n|\r/)
      .filter(f => !!f.trim())
      .filter(f => !f.startsWith('#'))
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
}
