import { SimpleFeature, fetchAndMaybeUnzipText } from '../../util/index.ts'
import { openLocation } from '../../util/io/index.ts'
import { BaseAdapter } from '../BaseAdapter/index.ts'

import type { BaseOptions } from '../BaseAdapter/types.ts'
import type { CytobandAdapterConfig } from './configSchema.ts'

export default class CytobandAdapter extends BaseAdapter<CytobandAdapterConfig> {
  async getData(opts?: BaseOptions) {
    const conf = this.getConf('cytobandLocation')
    if (!conf) {
      return []
    }

    const text = await fetchAndMaybeUnzipText(
      openLocation(conf, this.pluginManager),
      opts,
      'Downloading cytobands',
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
