import { NO_DATA_FOR_RESOLUTION } from '@gmod/hic'

import type { ContactRecords, HicFile, HicRegion } from '@gmod/hic'
import type { Region } from '@jbrowse/core/util/types'

export interface PairRead {
  records: ContactRecords
  appliedNormalization: string
}

export interface PairReadOptions {
  signal?: AbortSignal
  onProgress?: (current: number, total: number) => void
}

export function toHicRegion(region: Region): HicRegion {
  return { chr: region.refName, start: region.start, end: region.end }
}

/**
 * One region pair's contacts, `bin1` along `r1`, or undefined where the file
 * has no matrix for the pair at this binsize — routine for inter-chromosomal
 * pairs, which often carry only coarse binsizes.
 */
export async function readPair(
  hic: HicFile,
  r1: HicRegion,
  r2: HicRegion,
  normalization: string,
  resolution: number,
  opts: PairReadOptions,
): Promise<PairRead | undefined> {
  try {
    // `transposed` is the parser's own answer, decided from the file's
    // chromosome indices, which a caller would otherwise look up again.
    const { records, appliedNormalization, transposed } =
      await hic.getContactRecords(normalization, r1, r2, resolution, opts)
    return {
      records: transposed
        ? { bin1: records.bin2, bin2: records.bin1, counts: records.counts }
        : records,
      appliedNormalization,
    }
  } catch (e) {
    if (`${e}`.includes(NO_DATA_FOR_RESOLUTION)) {
      return undefined
    }
    throw e
  }
}
