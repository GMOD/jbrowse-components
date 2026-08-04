import { TabixIndexedFile } from '@gmod/tabix'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { withStopTokenSignal } from '@jbrowse/core/util/stopToken'
import { unzip } from '@jbrowse/core/util/unzip'
import { parsePlinkLDLine, resolvePlinkLDHeader } from '@jbrowse/ld-core'

import { PlinkLDAdapterBase } from './PlinkLDAdapterBase.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDHeader, PlinkLDRecord } from '@jbrowse/ld-core'

interface Config {
  ld: TabixIndexedFile
  header: PlinkLDHeader
}

// tabix's getHeader() hands back only the lines that begin with the index's
// meta character. A plink `.ld` is normally indexed `tabix -S 1`, because its
// header row carries no `#`, so getHeader() comes back EMPTY for it and the
// column layout falls back to DEFAULT_PLINK_LD_HEADER — whose `dprimeIdx` is
// -1. That is not cosmetic: `ldMetric: 'dprime'` then resolves to r² for every
// file indexed that way, and the legend still says D', so the display draws r²
// under a D' label. The index does record `skip: 1`; @gmod/tabix simply does
// not act on it.
//
// So read the first line off the front of the file instead. One range request,
// the same read BgzipTaffyAdapter makes for its own header line, and `unzip`
// tolerates the partial block at the end of it. A file that really has no
// header yields a data row, which resolvePlinkLDHeader rejects and falls back
// on exactly as before.
async function readFirstLine(fh: {
  read: (length: number, position: number) => Promise<Uint8Array>
}) {
  const buf = await fh.read(65536, 0)
  return new TextDecoder().decode(await unzip(buf)).split('\n', 1)[0] ?? ''
}

export default class PlinkLDTabixAdapter extends PlinkLDAdapterBase<Config> {
  protected statusLabel = 'Downloading index'

  protected async loadConfig(): Promise<Config> {
    const ldLocation = this.getConf('ldLocation')
    const location = this.getConf(['index', 'location'])
    const indexType = this.getConf(['index', 'indexType'])

    const filehandle = openLocation(ldLocation, this.pluginManager)
    const ld = new TabixIndexedFile({
      filehandle,
      ...openTabixIndexFilehandle(location, indexType, this.pluginManager),
      chunkCacheSize: 50 * 2 ** 20,
    })

    // Prefer what tabix reports, then the file's own first line (see
    // readFirstLine). LocusZoom-style files ship without a header row and land
    // on the default PLINK column order either way. A peek that throws leaves
    // the headerless default, which is what this did before it peeked at all,
    // so the extra read cannot make a file worse than it already was. tabix
    // skips any real `#`/`-S` header, so getLines still yields only data rows.
    let headerLine = await ld.getHeader()
    if (!headerLine) {
      try {
        headerLine = await readFirstLine(filehandle)
      } catch {
        headerLine = ''
      }
    }
    const { header } = resolvePlinkLDHeader(headerLine)

    return { ld, header }
  }

  public async getRefNames(opts: BaseOptions = {}) {
    const { ld } = await this.configure(opts)
    return ld.getReferenceSequenceNames(opts)
  }

  public async getLDRecords(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    const { refName, start, end } = query
    const { ld, header } = await this.configure(opts)

    const records: PlinkLDRecord[] = []

    await withStopTokenSignal(opts.stopToken, signal =>
      ld.getLines(refName, start, end, {
        lineCallback: (line: string) => {
          const record = parsePlinkLDLine(line, header)
          if (record) {
            records.push(record)
          }
        },
        ...opts,
        signal,
      }),
    )

    return records
  }
}
