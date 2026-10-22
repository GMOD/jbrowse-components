import { SimpleFeature } from '@jbrowse/core/util'
import {
  SV_TYPE_FIELD,
  categoricalField,
} from '@jbrowse/core/util/categoricalField'
import { svClassOf, svClassOfToken } from '@jbrowse/core/util/svAlt'

import type { GridRow } from './SpreadsheetModel.tsx'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface SvTypeTally {
  /** the class `svClassOf` names */
  type: string
  /** how a reader sees it named — "Deletion", "Breakend" */
  label: string
  count: number
}

/**
 * A row's SV class, or undefined for a record that is not a structural variant.
 * A row with no parsed record, as an older session can restore, is classed
 * from its declared SVTYPE token.
 */
export function rowSvType(
  feature: SimpleFeatureSerialized | undefined,
  token: unknown,
) {
  return (
    (feature
      ? ((feature.svType as string | undefined) ??
        svClassOf(new SimpleFeature(feature)))
      : svClassOfToken(typeof token === 'string' ? token : '')) || undefined
  )
}

const SV_TYPE = categoricalField(SV_TYPE_FIELD)

/**
 * The SV classes present in a set of rows, in legend order: the one tally both
 * the "Filter by SV type" dropdown and the circle's legend read. A record that
 * is not a structural variant has no class and is left out.
 */
export function tallySvTypes(rows: GridRow[] | undefined) {
  const tally = new Map<string, number>()
  for (const row of rows ?? []) {
    const type = row.derived.svType
    if (type) {
      tally.set(type, (tally.get(type) ?? 0) + 1)
    }
  }
  return [...tally]
    .map(([type, count]) => ({ type, label: SV_TYPE.label(type), count }))
    .sort((a, b) => SV_TYPE.compare(a.type, b.type)) satisfies SvTypeTally[]
}
