import { GFF_CONFIG, runSort } from './shared/sort-utils.ts'

export async function run(args?: string[]) {
  return runSort(GFF_CONFIG, 'sort-gff', args)
}
