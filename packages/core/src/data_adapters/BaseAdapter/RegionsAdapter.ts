import type { BaseAdapter } from './BaseAdapter'
import type { BaseOptions } from './types'
import type { NoAssemblyRegion } from '../../util'

export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}
