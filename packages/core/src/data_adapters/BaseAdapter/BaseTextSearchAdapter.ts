import type BaseResult from '../../TextSearch/BaseResults.ts'
import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseTextSearchArgs } from './types.ts'

/** #adapterBase BaseTextSearchAdapter | search-box hits out of a text index */
export interface BaseTextSearchAdapter extends BaseAdapter {
  searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]>
}
