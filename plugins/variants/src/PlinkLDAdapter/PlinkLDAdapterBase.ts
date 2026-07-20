import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { updateStatus } from '@jbrowse/core/util'

import { filterRecordsInRegion } from './filterRecordsInRegion.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { NoAssemblyRegion } from '@jbrowse/core/util/types'
import type {
  LDRecordSource,
  PlinkLDHeader,
  PlinkLDRecord,
} from '@jbrowse/ld-core'

/**
 * Shared machinery for the two pre-computed PLINK LD adapters. The loaded
 * payload differs — the plain adapter parses the whole file into an array, the
 * tabix one holds an index handle — so subclasses supply `loadConfig` and the
 * differing record queries (`getRefNames`, `getLDRecords`). Everything here (the
 * lazy cached-promise + status-label gate, `getHeader`, `getLDRecordsInRegion`)
 * is byte-for-byte identical between them.
 */
export abstract class PlinkLDAdapterBase<
  Config extends { header: PlinkLDHeader },
>
  extends BaseAdapter
  implements LDRecordSource
{
  private configured?: Promise<Config>

  // true once loadConfig has resolved; gates the status label so pan/zoom
  // re-entry into configure() doesn't re-flash the download label.
  private configureReady = false

  // Load and return the subclass payload (parsed records, or a tabix handle).
  protected abstract loadConfig(opts?: BaseOptions): Promise<Config>

  // Status label shown only while loadConfig is genuinely running.
  protected abstract statusLabel: string

  private loadConfigCached(opts?: BaseOptions) {
    this.configured ??= this.loadConfig(opts)
      .then(result => {
        this.configureReady = true
        return result
      })
      .catch((e: unknown) => {
        this.configured = undefined
        throw e
      })
    return this.configured
  }

  protected async configure(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts ?? {}
    return this.configureReady
      ? this.loadConfigCached(opts)
      : updateStatus(this.statusLabel, statusCallback, () =>
          this.loadConfigCached(opts),
        )
  }

  async getHeader(opts?: BaseOptions) {
    const { header } = await this.configure(opts)
    return header
  }

  public abstract getRefNames(opts?: BaseOptions): Promise<string[]>

  /**
   * Get LD records where the first SNP (A) falls within the query region.
   * Caller should additionally filter for snpB being in region if needed.
   */
  public abstract getLDRecords(
    query: NoAssemblyRegion,
    opts?: BaseOptions,
  ): Promise<PlinkLDRecord[]>

  /**
   * Get LD records where BOTH SNPs fall within the query region.
   * This is what's needed for the LD triangle display.
   */
  public async getLDRecordsInRegion(
    query: NoAssemblyRegion,
    opts: BaseOptions = {},
  ): Promise<PlinkLDRecord[]> {
    return filterRecordsInRegion(await this.getLDRecords(query, opts), query)
  }
}
