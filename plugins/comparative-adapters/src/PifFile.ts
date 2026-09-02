import { TabixIndexedFile } from '@gmod/tabix'
import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { downloadStatus, updateStatus } from '@jbrowse/core/util'
import { sharedBgzfWorkerPool } from '@jbrowse/core/util/bgzfWorkerPool'
import { decompressedBytesBudget } from '@jbrowse/core/util/cacheBudgets'
import { openLocation, openTabixIndexFilehandle } from '@jbrowse/core/util/io'
import {
  checkStopTokenThrottled,
  withStopTokenSignal,
} from '@jbrowse/core/util/stopToken'

import { parsePifHeader, parsePifLine } from './util.ts'

import type { PifLine, PifMeta } from './util.ts'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'
import type { LodTierInfo } from '@jbrowse/synteny-core'

/**
 * The tabix-indexed PIF file behind the two indexed adapters, and everything
 * they both did to it: opening it against the `pifGzLocation` + `index` slots
 * they declare identically, reading its contig list once, deciding from that
 * list whether the file carries a coarse tier, and scanning a range.
 *
 * A collaborator rather than a base class because the two adapters differ in
 * everything else — one is pairwise and one resolves PanSN samples — and
 * because the config reads happen here against the untyped `BaseFeatureDataAdapter`
 * view, leaving each adapter's own slot reads typed. Both adapters had this as
 * four members and a constructor apiece, and the constructors existed for
 * nothing else.
 */
export class PifFile {
  private tabix: TabixIndexedFile
  constructor(adapter: BaseFeatureDataAdapter) {
    const pm = adapter.pluginManager
    this.tabix = new TabixIndexedFile({
      filehandle: openLocation(adapter.getConf('pifGzLocation'), pm),
      ...openTabixIndexFilehandle(
        adapter.getConf(['index', 'location']),
        adapter.getConf(['index', 'indexType']),
        pm,
      ),
      chunkCacheBudget: decompressedBytesBudget,
      bgzfWorkerPool: sharedBgzfWorkerPool(),
    })
  }

  /**
   * What both adapters answer `CoreGetInfo` with: the header's facts plus
   * whether the coarse tier exists, in the shape the displays' `lodTier`
   * getters read (`LodTierInfo`), so the main thread resolves the tier the
   * adapter will actually serve.
   */
  info(opts?: BaseOptions) {
    return updateStatus(
      'Downloading header',
      opts?.statusCallback,
      async () => {
        const info: PifMeta & LodTierInfo = {
          ...(await this.meta(opts)),
          hasCoarseTier: await this.hasCoarseTier(opts),
        }
        return info
      },
    )
  }

  /**
   * The tabix contig list, read once. Every seqid is a refName prefixed with its
   * tier letter (fine q/t, coarse Q/T); both `getRefNames` and the coarse-tier
   * probe derive from this one fetch.
   */
  refSeqNames = cachedSetup({
    setup: opts => this.tabix.getReferenceSequenceNames(opts),
  })

  /**
   * The `#pif` header's facts, read once: empty for a file built before the
   * header existed.
   */
  meta = cachedSetup({
    setup: async opts => parsePifHeader(await this.tabix.getHeader(opts)),
  })

  /**
   * Whether make-pif emitted the coarse tier. The header says so when there is
   * one; otherwise it did if any seqid carries an uppercase T/Q prefix — the
   * tier letter is always the first character, so a sample whose PanSN name
   * itself starts with T/Q cannot false-positive (its fine seqid is `t`/`q` +
   * that name).
   */
  async hasCoarseTier(opts?: BaseOptions) {
    const { tiers } = await this.meta(opts)
    if (tiers !== undefined) {
      return tiers.includes('coarse')
    }
    const names = await this.refSeqNames(opts)
    return names.some(n => n.startsWith('T') || n.startsWith('Q'))
  }

  /**
   * Read one PIF range under a determinate download bar, parsing each line and
   * checking the stop token as it goes. Both adapters previously wrapped the
   * scan in a bare `updateStatus` — the only tabix adapters left showing a
   * spinner where the rest show bytes, and the only ones that ran a cancelled
   * query to completion.
   */
  readLines({
    seqid,
    start,
    end,
    statusCallback,
    stopTokenCheck,
    lineCallback,
  }: {
    seqid: string
    start: number
    end: number
    statusCallback: StatusCallback | undefined
    stopTokenCheck: StopTokenChecker
    lineCallback: (line: PifLine, fileOffset: number) => void
  }) {
    // the signal comes off the checker's own token, so the caller passes one
    // cancellation handle rather than two that could disagree
    return withStopTokenSignal(stopTokenCheck.stopToken, signal =>
      downloadStatus('Downloading features', statusCallback, onProgress =>
        this.tabix.getLines(seqid, start, end, {
          onProgress,
          lineCallback: (line, fileOffset) => {
            checkStopTokenThrottled(stopTokenCheck)
            lineCallback(parsePifLine(line), fileOffset)
          },
          signal,
        }),
      ),
    )
  }
}
