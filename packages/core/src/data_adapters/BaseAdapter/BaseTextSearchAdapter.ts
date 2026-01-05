import type { BaseAdapter } from './BaseAdapter'
import type { BaseTextSearchArgs } from './types'
import type BaseResult from '../../TextSearch/BaseResults'

export interface BaseTextSearchAdapter extends BaseAdapter {
  searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]>
}
