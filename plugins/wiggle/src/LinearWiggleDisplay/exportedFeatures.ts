import { SimpleFeature } from '@jbrowse/core/util'
import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { numericValue } from '@jbrowse/core/util/numericValue'
import { isSummaryField } from '@jbrowse/wiggle-core/summaryFields'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * The features a wiggle display exports, as it draws them: none of a hidden
 * subtrack's, and each scored by the field the plot reads. A stored summary
 * (`score`, `minScore`, `maxScore`) is the file's own `score`, so those
 * features pass as they are; any other `y` is read as the worker reads it
 * (`featuresToRaw`) and written as the score the export formats print.
 */
export function exportedWiggleFeatures({
  features,
  hidden,
  yField,
  jexl,
}: {
  features: Feature[]
  hidden: ReadonlySet<string>
  yField: string
  jexl?: JexlInstance
}) {
  const shown =
    hidden.size > 0
      ? features.filter(f => !hidden.has(f.get('source') ?? ''))
      : features
  const read = isSummaryField(yField) ? undefined : fieldReader(yField, jexl)
  return read
    ? shown.map(
        f =>
          new SimpleFeature({
            ...f.toJSON(),
            score: numericValue(read(f)),
          }),
      )
    : shown
}
