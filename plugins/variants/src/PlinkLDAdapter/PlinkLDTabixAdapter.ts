import { TabixIndexedFile } from '@gmod/tabix'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import { withStopTokenSignal } from '@jbrowse/core/util/stopToken'
import { unzip } from '@jbrowse/core/util/unzip'
import {
  DEFAULT_PLINK_LD_HEADER,
  parsePlinkLDHeader,
  parsePlinkLDLine,
  resolvePlinkLDHeader,
} from '@jbrowse/ld-core'

import { PlinkLDAdapterBase } from './PlinkLDAdapterBase.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type { PlinkLDHeader, PlinkLDRecord } from '@jbrowse/ld-core'

interface Config {
  ld: TabixIndexedFile
  header: PlinkLDHeader
}

// One 64 KB range request off the front of the file — the same read
// BgzipTaffyAdapter makes for its own header line, and `unzip` tolerates the
// partial block at the end of it.
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

    // The column layout decides whether the file's D' column is found at all,
    // so `ldMetric: 'dprime'` lives or dies here.
    //
    // A commented header (`#CHR_A …`) comes back from getHeader() and is
    // resolved from its content, which is safe because the meta character
    // already proved it is not data.
    //
    // A plink `.ld` more often carries a BARE header row and is indexed
    // `tabix -S 1`. getHeader() returns only lines starting with the meta
    // character, so it reports nothing — while the index says, in `skipLines`,
    // that the first line is a header. Ask the index rather than inferring from
    // the line's content: `skipLines` is a statement by the file's own index,
    // where "does this look like a header" is a guess, and it is a guess that
    // misfires on a headerless file whose chromosome column reads `CHR1`.
    //
    // Neither branch can do worse than the old headerless default: an
    // unreadable or unparseable header falls back to it, which is what every
    // `-S 1` file got before.
    const headerLine = await ld.getHeader()
    let header = DEFAULT_PLINK_LD_HEADER
    if (headerLine) {
      header = resolvePlinkLDHeader(headerLine).header
    } else if (((await ld.getMetadata()).skipLines ?? 0) > 0) {
      try {
        header = parsePlinkLDHeader(await readFirstLine(filehandle))
      } catch {
        // declared header, unreadable or unrecognizable: the default layout
        // still finds the position and r² columns
      }
    }

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
