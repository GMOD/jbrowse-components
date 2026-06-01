import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseOptions } from './types.ts'
import type { Feature } from '../../util/index.ts'

export interface CytobandAdapter extends BaseAdapter {
  getData(opts?: BaseOptions): Promise<Feature[]>
}
