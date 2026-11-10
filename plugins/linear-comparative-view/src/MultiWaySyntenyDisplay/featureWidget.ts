import { getMate } from '../syntenyMate.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * The panel a clicked feature opens: the synteny one, whose links read the
 * record as sitting on the view's genome, for a record on the anchor that
 * names a mate, and the default for a lane gene, a gene-table group or a
 * record between two mate lanes
 */
export function featureWidgetOf(
  feature: Feature,
  isAnchor: (assemblyName: string) => boolean,
) {
  const own: unknown = feature.get('assemblyName')
  return getMate(feature) && (typeof own !== 'string' || isAnchor(own))
    ? { type: 'SyntenyFeatureWidget', id: 'syntenyFeature' }
    : undefined
}
