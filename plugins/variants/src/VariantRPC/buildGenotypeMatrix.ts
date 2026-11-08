import { dosageMatrixOf } from './getGenotypeMatrix.ts'
import { phasedMatrixOf } from './getPhasedGenotypeMatrix.ts'
import { prepareMatrixWalk } from './matrixWalk.ts'

import type { MatrixWalk, MatrixWalkArgs } from './matrixWalk.ts'
import type { GetGenotypeMatrixArgs } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// The one place that decides which matrix a rendering mode wants: one row per
// haplotype in phased mode, one row per sample otherwise. Both the auto
// (WASM) and manual (R export) clustering paths go through here — when only the
// auto path branched, the manual dialog in phased mode built haplotype-labelled
// rows that each held the same per-sample dosage vector, so a sample's two
// haplotypes were identical by construction and the pasted order was a
// sample-level clustering wearing haplotype labels.
export async function buildGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MatrixWalkArgs
}) {
  return genotypeMatrixOf(
    await prepareMatrixWalk({ pluginManager, args }),
    args,
  )
}

/** {@link buildGenotypeMatrix} over the features `walk` already holds. */
export function genotypeMatrixOf(
  walk: MatrixWalk,
  {
    sources,
    rowsField,
    samplePloidy,
  }: Pick<GetGenotypeMatrixArgs, 'sources' | 'rowsField' | 'samplePloidy'>,
) {
  return rowsField === 'haplotype' && samplePloidy
    ? phasedMatrixOf(walk, sources, samplePloidy)
    : dosageMatrixOf(walk, sources)
}
