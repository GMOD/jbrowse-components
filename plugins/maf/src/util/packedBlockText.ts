import type { Feature } from '@jbrowse/core/util'

/**
 * The string a sub-adapter feature carries its packed MAF block in.
 *
 * Guarded rather than cast because the field name comes from the file's own
 * column names or autoSql, so a file that is not the alignment one lacks it:
 * the summary BED or `bigMafSummary.bb` that an adapter's `summaryAdapter` slot
 * wants is easy to put in the alignment slot, and cast, that reached `.split`
 * on `undefined` for every feature with nothing in the error naming a MAF, a
 * column, or a file.
 */
export function packedBlockText(
  feature: Feature,
  {
    adapterName,
    field,
    noun,
    expected,
  }: { adapterName: string; field: string; noun: string; expected: string },
) {
  const text = feature.get(field)
  if (typeof text !== 'string') {
    throw new Error(
      `${adapterName}: no ${noun} at ${feature.get('refName')}:${feature.get('start')}. ${expected}`,
    )
  }
  return text
}
