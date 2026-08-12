import type { NoAssemblyRegion } from '../../util/index.ts'
import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseOptions } from './types.ts'

/** #adapterBase RegionsAdapter | which regions an assembly has, and how long each is */
export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}
