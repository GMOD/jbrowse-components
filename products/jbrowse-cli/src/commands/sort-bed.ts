import { BED_CONFIG, runSort } from './shared/sort-utils.ts'

export async function run(args?: string[]) {
  return runSort(BED_CONFIG, 'sort-bed', args)
}
