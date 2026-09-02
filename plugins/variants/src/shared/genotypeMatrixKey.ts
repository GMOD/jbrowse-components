import type { ReducedModel } from './clusterModelTypes.ts'

/**
 * The cluster dialog's fetch key for the exported genotype matrix: the run
 * arguments that decide what comes back, and nothing else.
 *
 * `useFetch` serializes its key on every render, and the key used to be the MST
 * display node — which stringifies to the whole display snapshot, `layout`
 * included, so a cohort's worth of rows was serialized per render and any
 * unrelated slot write re-keyed the fetch and re-ran the worker. The dialog
 * adds the region and the zoom itself.
 *
 * `undefined` when the sources have not landed: there is nothing to export yet,
 * which is the `null` the dialog turns it into.
 */
export function genotypeMatrixKey(model: ReducedModel) {
  const { sourcesBase } = model
  return sourcesBase
    ? ([
        'genotypeMatrix',
        sourcesBase.map(s => s.name).join('\t'),
        model.minorAlleleFrequencyFilter,
        model.maxMissingnessFilter,
        model.renderingMode,
        // a SerializableFilterChain, whose toJSON is its expression list
        model.filters,
      ] as const)
    : null
}
