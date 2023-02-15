import { unzip } from '@gmod/bgzf-filehandle'

// locals
import { SimpleFeature } from '../../util'
import { openLocation } from '../../util/io'
import { BaseAdapter } from '../BaseAdapter'

export function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export default class CytobandAdapter extends BaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getData() {
    const loc = this.getConf('cytobandLocation')
    if (loc.uri === '' || loc.uri === '/path/to/cytoband.txt.gz') {
      return []
    }
    const buffer = (await openLocation(loc).readFile()) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)
    return text
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
