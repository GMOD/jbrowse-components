import type { ReducedModel } from './clusterModelTypes.ts'
import type { Region } from '@jbrowse/core/util'

/**
 * The cluster dialog's fetch key for the exported genotype matrix: the run
 * arguments that decide what comes back, and nothing else.
 *
 * `useFetch` serializes its key on every render, and the key used to be the MST
 * display node — which stringifies to the whole display snapshot, so any
 * unrelated write re-keyed the fetch and re-ran the worker. The dialog
 * adds the region and the zoom itself.
 *
 * `undefined` when the sources have not landed: there is nothing to export yet,
 * which is the `null` the dialog turns it into.
 */
export function genotypeMatrixKey(model: ReducedModel) {
  return model.sourcesBase
    ? ([
        'genotypeMatrix',
        model.shownRows.map(s => s.name).join('\t'),
        model.siteFilter,
        model.rowsField,
        // a SerializableFilterChain, whose toJSON is its expression list
        model.filters,
        ...mendelianKey(model),
      ] as const)
    : null
}

function mendelianKey(model: ReducedModel) {
  return model.mendelianFilter.length > 0
    ? [model.mendelianFilter, model.trios, model.transmissionEntries]
    : []
}

/**
 * The genotype matrix's arguments over `regions`, which the export and both
 * clustering paths send alike: the rows on screen, and the sites the display
 * keeps, the Mendelian check's filter among them, whose trios and rules are
 * sent only while it is set.
 */
export function genotypeMatrixArgs(model: ReducedModel, regions: Region[]) {
  return {
    regions,
    sources: model.shownRows,
    siteFilter: model.siteFilter,
    filters: model.filters,
    adapterConfig: model.adapterConfig,
    rowsField: model.rowsField,
    samplePloidy: model.samplePloidy,
    ...(model.mendelianFilter.length > 0
      ? {
          mendelianFilter: model.mendelianFilter,
          trios: model.trios,
          transmission: model.transmissionFor(regions),
        }
      : {}),
  }
}
