import type { BaseAdapter } from './BaseAdapter.ts'
import type { BaseOptions } from './types.ts'

export interface Alias {
  refName: string
  aliases: string[]
  override?: boolean
  /**
   * what the sequence is within its assembly, in NCBI's vocabulary:
   * `assembled-molecule`, `unlocalized-scaffold`, `unplaced-scaffold`,
   * `alt-scaffold`, `fix-patch` or `novel-patch`
   */
  role?: string
  /**
   * the molecule an assembled sequence is, in NCBI's vocabulary: `Chromosome`,
   * `Linkage Group`, `Mitochondrion`, `Chloroplast`, ...
   */
  molecule?: string
}
/** #adapterBase BaseRefNameAliasAdapter | refName aliases, e.g. `chr1` for `1` */
export interface BaseRefNameAliasAdapter extends BaseAdapter {
  getRefNameAliases(opts: BaseOptions): Promise<Alias[]>
}
