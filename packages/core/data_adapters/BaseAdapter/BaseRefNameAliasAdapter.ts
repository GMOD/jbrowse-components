import type { BaseAdapter } from './BaseAdapter'
import type { BaseOptions } from './types'

export interface Alias {
  refName: string
  aliases: string[]
  override?: boolean
}
export interface BaseRefNameAliasAdapter extends BaseAdapter {
  getRefNameAliases(opts: BaseOptions): Promise<Alias[]>
}
