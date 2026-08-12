import type { Feature } from '../../util/index.ts'
import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseOptions } from './types.ts'

/** #adapterBase CytobandAdapter | cytoband features for the ideogram */
export interface CytobandAdapter extends BaseAdapter {
  getData(opts?: BaseOptions): Promise<Feature[]>
}
