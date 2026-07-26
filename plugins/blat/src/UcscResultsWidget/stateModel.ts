import { types } from '@jbrowse/mobx-state-tree'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel UcscResultsWidget
 * The hit table for one UCSC BLAT or in-silico PCR query. The features are the
 * same ones the result track was built from, so the list and the track can't
 * disagree.
 */
export function stateModelFactory() {
  return types.model('UcscResultsWidget', {
    /**
     * #property
     */
    id: types.identifier,
    /**
     * #property
     */
    type: types.literal('UcscResultsWidget'),
    /**
     * #property
     * hits, best first (BLAT sorts by score; hgPcr returns products in order)
     */
    features: types.frozen<SimpleFeatureSerialized[]>([]),
    /**
     * #property
     * assembly the hits are on, for navigating and for the header line
     */
    assembly: types.string,
    /**
     * #property
     * name of the on-the-fly track these hits were added as
     */
    trackName: types.string,
    /**
     * #property
     * what one result is called. A BLAT result is a hit; an hgPcr result is a
     * product, which is a band on a gel — the word a bench scientist reasons in,
     * and "2 hits" understates what two of them mean for a PCR run
     */
    resultNoun: types.optional(types.enumeration(['hit', 'product']), 'hit'),
  })
}

export type UcscResultsWidgetStateModel = ReturnType<typeof stateModelFactory>
export type UcscResultsWidgetModel = Instance<UcscResultsWidgetStateModel>
