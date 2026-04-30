import { addInstance } from '../../shared/instanceWriter.ts'

import type { CigarColorArrays } from '../../shared/instanceWriter.ts'
import type { InstanceBuilder } from '@jbrowse/alignments-core'

// DEBUG: when true, mismatches are emitted as wider bp spans so they're
// obviously visible at low zoom — proves the SNP data path is intact even
// when 1-px clamped pips are too small to see against the strand fill.
const DEBUG_FAT_SNPS =
  typeof globalThis !== 'undefined' &&
  // @ts-expect-error window-injected debug flag
  globalThis.__DEBUG_FAT_SNPS === true

export function emitMismatchGpu(
  builder: InstanceBuilder,
  refPos: number,
  len: number,
  queryBase: string | undefined,
  genomeRow: number,
  featureId: number,
  rgba: CigarColorArrays,
) {
  const color = (queryBase ? rgba.bases[queryBase] : undefined) ?? rgba.mismatch
  const widened = DEBUG_FAT_SNPS ? len + 30 : len
  addInstance(builder, refPos, refPos + widened, genomeRow, featureId, color)
}
