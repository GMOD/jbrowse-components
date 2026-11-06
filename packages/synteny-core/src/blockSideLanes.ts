import { UNNAMED, makeStringDict } from './stringDict.ts'
import { getRecordName } from './syntenyMate.ts'

import type { SyntenyFeatureLanes } from './syntenyFeatureLanes.generated.ts'
import type { Feature } from '@jbrowse/core/util'

export type BlockSideLanes = Pick<
  SyntenyFeatureLanes,
  | 'nameDict'
  | 'nameIds'
  | 'refNameDict'
  | 'refNameIds'
  | 'starts'
  | 'mateNameDict'
  | 'mateNameIds'
  | 'mateRefNameDict'
  | 'mateRefNameIds'
  | 'mateStarts'
>

interface BlockSide {
  refName: string
  start: number
}

/**
 * Where both sides of a comparative block sit and what they name — each side's
 * contig, its start in that contig's own bp, and the gene the source paired
 * there — packed the same way by the synteny and dotplot workers, so one record
 * hovers the same in both views.
 *
 * On an MCScan or ortholog-table track every gene is distinct, so the name
 * dictionaries grow as long as the fetch; a PAF names nothing and they hold one
 * `UNNAMED`. See `makeStringDict` for why a dictionary still ships them.
 */
export function createBlockSideLanes(count: number) {
  const nameIds = new Uint32Array(count)
  const refNameIds = new Uint32Array(count)
  const starts = new Uint32Array(count)
  const mateNameIds = new Uint32Array(count)
  const mateRefNameIds = new Uint32Array(count)
  const mateStarts = new Uint32Array(count)
  const names = makeStringDict()
  const refNames = makeStringDict()
  const mateNames = makeStringDict()
  const mateRefNames = makeStringDict()
  return {
    write(
      i: number,
      feature: Feature,
      side: BlockSide,
      mate: BlockSide & { name?: string },
    ) {
      nameIds[i] = names.idFor(getRecordName(feature) ?? UNNAMED)
      refNameIds[i] = refNames.idFor(side.refName)
      starts[i] = side.start
      mateNameIds[i] = mateNames.idFor(mate.name ?? UNNAMED)
      mateRefNameIds[i] = mateRefNames.idFor(mate.refName)
      mateStarts[i] = mate.start
    },
    finish(validCount: number) {
      return {
        nameDict: names.dict,
        nameIds: nameIds.subarray(0, validCount),
        refNameDict: refNames.dict,
        refNameIds: refNameIds.subarray(0, validCount),
        starts: starts.subarray(0, validCount),
        mateNameDict: mateNames.dict,
        mateNameIds: mateNameIds.subarray(0, validCount),
        mateRefNameDict: mateRefNames.dict,
        mateRefNameIds: mateRefNameIds.subarray(0, validCount),
        mateStarts: mateStarts.subarray(0, validCount),
      } satisfies BlockSideLanes
    },
  }
}
