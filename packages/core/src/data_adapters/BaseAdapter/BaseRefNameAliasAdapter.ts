import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseOptions } from './types.ts'

export interface Alias {
  refName: string
  aliases: string[]
  override?: boolean
}
export interface BaseRefNameAliasAdapter extends BaseAdapter {
  getRefNameAliases(opts: BaseOptions): Promise<Alias[]>
}
