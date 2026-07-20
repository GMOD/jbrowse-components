import type { NoAssemblyRegion } from '../../util/index.ts'
import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseOptions } from './types.ts'

export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}
