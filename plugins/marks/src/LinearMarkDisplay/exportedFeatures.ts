import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { runTransforms } from '@jbrowse/core/util/featureTransforms'
import { fieldReader } from '@jbrowse/core/util/fieldReader'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'
import type { TransformStep } from '@jbrowse/core/util/markEncoding'

/**
 * The features a mark display draws out of a fetch: through the `filter`
 * steps the worker runs, by the same transform code, then outside the
 * sections the user hid, each feature keyed the way `facetLayers` keys it.
 */
export function exportedMarkFeatures({
  features,
  filterSteps,
  facetField,
  hidden,
  jexl,
}: {
  features: Feature[]
  filterSteps: readonly TransformStep[]
  facetField: string | undefined
  hidden: ReadonlySet<string>
  jexl: JexlInstance
}) {
  const kept = runTransforms(features, filterSteps, jexl)
  const shown = Array.from({ length: kept.length }, (_, i) => kept.row(i))
  return facetField === undefined || hidden.size === 0
    ? shown
    : withoutHiddenSections(shown, facetField, hidden, jexl)
}

function withoutHiddenSections(
  features: Feature[],
  facetField: string,
  hidden: ReadonlySet<string>,
  jexl: JexlInstance,
) {
  const read = fieldReader(facetField, jexl)
  const { key } = categoricalField(facetField)
  return features.filter(f => !hidden.has(key(read(f))))
}
