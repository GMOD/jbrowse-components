import type BaseResult from '../../TextSearch/BaseResults.ts'
import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseTextSearchArgs } from './types.ts'

export interface BaseTextSearchAdapter extends BaseAdapter {
  searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]>
}
