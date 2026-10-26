import { predicatesOf } from '@jbrowse/core/util/fieldPredicate'

import { layerEntryProblems } from './layerFilterRules.ts'

import type { LayerFilterField } from './layerFilterRules.ts'

/** `layerEntryProblems` over a written `filter`, normalized first. */
export function layerFilterProblems(
  path: string,
  filter: unknown,
  fields: Readonly<Record<string, LayerFilterField>>,
) {
  return layerEntryProblems(path, predicatesOf(filter), fields)
}
