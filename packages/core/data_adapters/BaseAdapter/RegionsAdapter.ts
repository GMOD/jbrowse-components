import { NoAssemblyRegion } from '../../util'
import { BaseAdapter } from './BaseAdapter'
import { BaseOptions } from './types'

export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}
