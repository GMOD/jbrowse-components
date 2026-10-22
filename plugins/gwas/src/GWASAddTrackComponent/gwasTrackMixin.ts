import {
  DEFAULT_SCORE_COLUMN,
  DEFAULT_SCORE_TRANSFORM,
  scoreAdapterFields,
} from '../GWASAdapter/configSchema.ts'
import { LD_MARKS } from '../LinearManhattanDisplay/ldPlot.ts'
import {
  buildLdAdapterConfig,
  isTabixLocation,
  needsExplicitIndex,
} from './ldAdapterConfig.ts'

import type { FileLocation } from '@jbrowse/core/util/types'

/** The GWAS fields of the add-track form. */
export interface GwasForm {
  scoreColumn: string
  scoreTransform: string
  ldLocation?: FileLocation
  ldIndexLocation?: FileLocation
}

export const INITIAL_GWAS_FORM: GwasForm = {
  scoreColumn: DEFAULT_SCORE_COLUMN,
  scoreTransform: DEFAULT_SCORE_TRANSFORM,
}

/** A bgzipped LD file uploaded with no index beside it to find. */
export function ldIndexMissing({ ldLocation, ldIndexLocation }: GwasForm) {
  return (
    !!ldLocation &&
    !ldIndexLocation &&
    isTabixLocation(ldLocation) &&
    needsExplicitIndex(ldLocation)
  )
}

/**
 * What the GWAS fields add to the track config: the score fields away from
 * their defaults, and with an LD file, its sub-adapter and a plot colored by
 * r² to the index SNP. An LD file still missing its index adds neither.
 */
export function gwasTrackMixin(form: GwasForm) {
  const { ldLocation, ldIndexLocation } = form
  const ld = ldLocation && !ldIndexMissing(form) ? ldLocation : undefined
  return {
    adapter: {
      ...scoreAdapterFields(form),
      ...(ld ? { ldAdapter: buildLdAdapterConfig(ld, ldIndexLocation) } : {}),
    },
    ...(ld ? { displayDefaults: { marks: LD_MARKS } } : {}),
  }
}
