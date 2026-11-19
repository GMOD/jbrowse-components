import type { NoAssemblyRegion } from '../../util/index.ts'
import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseOptions } from './types.ts'

/** A sequence's extent, and whether the file declares it circular */
export interface SequenceRegion extends NoAssemblyRegion {
  circular?: boolean
}

/** #adapterBase RegionsAdapter | which regions an assembly has, and how long each is */
export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<SequenceRegion[]>
}
