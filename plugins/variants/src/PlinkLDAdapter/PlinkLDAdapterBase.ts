import {
  BaseAdapter,
  cachedSetup,
} from '@jbrowse/core/data_adapters/BaseAdapter'

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
 * `cachedSetup` memo, `getHeader`, `getLDRecordsInRegion`) is byte-for-byte
 * identical between them.
 */
export abstract class PlinkLDAdapterBase<
  Config extends { header: PlinkLDHeader },
>
  extends BaseAdapter
  implements LDRecordSource
{
  // Load and return the subclass payload (parsed records, or a tabix handle).
  protected abstract loadConfig(opts?: BaseOptions): Promise<Config>

  // Status label shown while loadConfig is genuinely running. A method, not a
  // property: `configure`'s field initializer below calls it during base-class
  // construction, before any subclass property would exist (and TS2715 refuses
  // an abstract property or getter there).
  protected abstract statusLabel(): string

  protected configure = cachedSetup({
    label: this.statusLabel(),
    setup: opts => this.loadConfig(opts),
  })

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
