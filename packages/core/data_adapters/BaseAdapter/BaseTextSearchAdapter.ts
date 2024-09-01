import BaseResult from '../../TextSearch/BaseResults'
import { BaseTextSearchArgs } from './types'
import { BaseAdapter } from './BaseAdapter'

export interface BaseTextSearchAdapter extends BaseAdapter {
  searchIndex(args: BaseTextSearchArgs): Promise<BaseResult[]>
}
